#!/usr/bin/env node
/**
 * Keep the podcast feed current, unattended.
 *
 *   node scripts/update-feed.mjs
 *
 * Refreshes the chain index, finds episodes that have a manifest but no audio
 * yet, runs extract-audio.sh for each over ssh on the slop server, merges the
 * results into scripts/audio-map.json, rebuilds feed.xml, and commits + pushes
 * the two files (push = deploy: Vercel is git-connected).
 *
 * Cron-safe by construction: exits 0 quietly when nothing is new; a failed
 * extraction (e.g. video still pinning right after a show) is skipped and
 * retried next run; refuses to touch git when the worktree is dirty or off
 * main, so it never commits someone's work in progress.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MAP_PATH = join(ROOT, "scripts/audio-map.json");
const FEED_PATH = "packages/nextjs/public/feed.xml";
const SSH_HOST = process.env.SLOP_SSH_HOST || "slopcomputer";
const GATEWAY = process.env.IPFS_GATEWAY || "https://media.slop.computer/ipfs";

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts });
const git = (...args) => run("git", args).trim();
const ssh = (remote, opts) =>
  run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", SSH_HOST, remote], opts);

// 1. Never fight a human: only operate on a clean main checkout.
if (git("status", "--porcelain") !== "") {
  console.log("worktree dirty — skipping this run");
  process.exit(0);
}
if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") {
  console.log("not on main — skipping this run");
  process.exit(0);
}
git("pull", "--ff-only", "--quiet");

// 2. Refresh the chain index, then diff it against the audio map.
run("node", ["scripts/fetch-transcripts.mjs"]);
const index = JSON.parse(readFileSync(join(ROOT, "transcripts/index.json"), "utf8"));
const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));

const missing = Object.values(index)
  .filter(e => (e.manifest || "").startsWith("ipfs://") && !map[e.slug])
  .sort((a, b) => (a.datetime || 0) - (b.datetime || 0));

if (!missing.length) {
  // transcripts/ is gitignored, so a no-op run leaves the repo untouched.
  console.log("feed is current — nothing to do");
  process.exit(0);
}

// 3. Extract audio on the slop server. Episodes whose manifest already carries
// an `audio` field (the future live-pipeline) need no extraction — build-feed
// prefers manifest.audio, so just rebuilding picks them up.
const wanted = [];
for (const e of missing) {
  const cid = e.manifest.slice(7);
  let m;
  try {
    m = await fetch(`${GATEWAY}/${cid}`).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
  } catch (err) {
    console.error(`skip ${e.slug}: manifest fetch failed (${err})`);
    continue;
  }
  if (m.audio) continue;
  try {
    console.log(ssh(`./extract-audio.sh ${e.slug} ${cid}`).trim());
    wanted.push(e.slug);
  } catch {
    console.error(`skip ${e.slug}: extract-audio failed (will retry next run)`);
  }
}

// 4. Merge the server's results into the map.
let added = [];
if (wanted.length) {
  const results = ssh("cat ~/podcast-audio/results.jsonl")
    .split("\n")
    .filter(Boolean)
    .map(l => JSON.parse(l));
  for (const slug of wanted) {
    const r = results.findLast(r => r.slug === slug);
    if (!r) continue;
    map[slug] = { cid: r.audioCid, sizeBytes: r.sizeBytes, durationSec: r.durationSec, format: r.format };
    added.push(slug);
  }
  writeFileSync(MAP_PATH, JSON.stringify(map, null, 1) + "\n");
}

// 5. Rebuild the feed and ship it if anything moved.
run("node", ["scripts/build-feed.mjs"]);
if (git("status", "--porcelain", "--", "scripts/audio-map.json", FEED_PATH) === "") {
  console.log("no feed change");
  process.exit(0);
}
git("add", "scripts/audio-map.json", FEED_PATH);
git("commit", "-m", `podcast: feed auto-update (${added.join(", ") || "rebuild"})`);
git("push", "--quiet");
console.log(`pushed feed update: ${added.join(", ") || "rebuild only"}`);
