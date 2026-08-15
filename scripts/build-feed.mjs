#!/usr/bin/env node
/**
 * Build the podcast RSS feed from chain-derived episode data.
 *
 *   node scripts/fetch-transcripts.mjs   # refresh transcripts/index.json first
 *   node scripts/build-feed.mjs          # → packages/nextjs/public/feed.xml
 *
 * Inputs:
 *   transcripts/index.json     — per-episode metadata (from chain + IPFS)
 *   scripts/audio-map.json     — slug → {audioCid,sizeBytes,durationSec,format}
 *                                (produced by extract-audio.sh on the media box;
 *                                once manifests carry an `audio` field this map
 *                                becomes a fallback only)
 *   transcripts/manifests/     — manifest cache, keyed by CID (immutable)
 *
 * Zero dependencies. The feed rides the static export: Vercel + IPFS + ENS.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const GATEWAY = process.env.IPFS_GATEWAY || "https://media.slop.computer/ipfs";
const SITE = "https://slop.computer";
const FEED_URL = `${SITE}/feed.xml`;
const OUT = join(ROOT, "packages/nextjs/public/feed.xml");
const MANIFEST_CACHE = join(ROOT, "transcripts/manifests");

const CHANNEL = {
  title: "slop.computer",
  description:
    "An onchain podcast about agents, builders, and shipping software. " +
    "Live conversations with the people building crypto and AI — every episode " +
    "pinned to IPFS and indexed on Ethereum mainnet. Tune in. Log on. Stay sloppy.",
  author: "austingriffith.eth",
  ownerName: "Austin Griffith",
  ownerEmail: "austin.griffith@ethereum.org",
  category: "Technology",
  explicit: "true",
  image: `${SITE}/podcast-cover.png`,
  language: "en-us",
};

const esc = s =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const rfc2822 = unixSec => new Date(unixSec * 1000).toUTCString();

// podcast:guid per the podcast namespace spec: UUIDv5 of the feed url
// (scheme stripped) under the podcast namespace UUID.
import { createHash } from "node:crypto";
function podcastGuid(url) {
  const NS = "ead4c236-bf58-58c6-a2c6-a6b28d128cb6";
  const nsBytes = Buffer.from(NS.replace(/-/g, ""), "hex");
  const h = createHash("sha1").update(nsBytes).update(url.replace(/^https?:\/\//, "")).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

async function manifest(cid) {
  mkdirSync(MANIFEST_CACHE, { recursive: true });
  const cached = join(MANIFEST_CACHE, cid + ".json");
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, "utf8"));
  const res = await fetch(`${GATEWAY}/${cid}`);
  if (!res.ok) throw new Error(`manifest ${cid}: HTTP ${res.status}`);
  const m = await res.json();
  writeFileSync(cached, JSON.stringify(m));
  return m;
}

const index = JSON.parse(readFileSync(join(ROOT, "transcripts/index.json"), "utf8"));
const audioMap = JSON.parse(readFileSync(join(ROOT, "scripts/audio-map.json"), "utf8"));

const episodes = Object.values(index)
  .filter(e => (e.manifest || "").startsWith("ipfs://"))
  .sort((a, b) => (a.datetime || 0) - (b.datetime || 0));

const items = [];
let skipped = 0;
for (let i = 0; i < episodes.length; i++) {
  const e = episodes[i];
  const manifestCid = e.manifest.slice(7);
  const m = await manifest(manifestCid);
  // manifest audio (new pipeline) wins; backfill map is the fallback
  const audio = m.audio || audioMap[e.slug];
  if (!audio) {
    console.error(`skip ${e.slug}: no audio yet`);
    skipped++;
    continue;
  }
  const fmt = audio.format || "audio/mp4";
  const ext = fmt === "audio/mpeg" ? "mp3" : "m4a";
  const title = m.meta?.title || e.meta?.title || e.name;
  const desc = m.meta?.description || e.meta?.description || e.meta?.oneLiner || "";
  const cardCid = m.card?.cid;
  items.push(`    <item>
      <title>${esc(title)}</title>
      <link>${SITE}/${esc(e.slug)}</link>
      <guid isPermaLink="false">${esc(manifestCid)}</guid>
      <pubDate>${rfc2822(e.datetime)}</pubDate>
      <description>${esc(desc)}</description>
      <enclosure url="${GATEWAY}/${audio.cid || audio.audioCid}?filename=${esc(e.slug)}.${ext}" length="${audio.sizeBytes}" type="${fmt}"/>
      <itunes:duration>${audio.durationSec ?? audio.duration ?? 0}</itunes:duration>
      <itunes:episode>${i + 1}</itunes:episode>
      <itunes:explicit>${CHANNEL.explicit}</itunes:explicit>${cardCid ? `
      <itunes:image href="${GATEWAY}/${cardCid}"/>` : ""}
    </item>`);
}

const newest = episodes.at(-1);
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:podcast="https://podcastindex.org/namespace/1.0"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(CHANNEL.title)}</title>
    <link>${SITE}</link>
    <description>${esc(CHANNEL.description)}</description>
    <language>${CHANNEL.language}</language>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <podcast:guid>${podcastGuid(FEED_URL)}</podcast:guid>
    <itunes:author>${esc(CHANNEL.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${esc(CHANNEL.ownerName)}</itunes:name>
      <itunes:email>${esc(CHANNEL.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:category text="${esc(CHANNEL.category)}"/>
    <itunes:explicit>${CHANNEL.explicit}</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:image href="${CHANNEL.image}"/>
    <image>
      <url>${CHANNEL.image}</url>
      <title>${esc(CHANNEL.title)}</title>
      <link>${SITE}</link>
    </image>
    <lastBuildDate>${rfc2822(newest?.datetime || 0)}</lastBuildDate>
${items.reverse().join("\n")}
  </channel>
</rss>
`;

writeFileSync(OUT, feed);
console.log(`feed.xml: ${items.length} episodes (${skipped} skipped, no audio) → ${OUT}`);
