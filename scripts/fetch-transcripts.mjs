#!/usr/bin/env node
/**
 * Pull every episode's transcript (and chat + meta) down from chain + IPFS
 * into ./transcripts/ so they can be searched/distilled locally.
 *
 *   node scripts/fetch-transcripts.mjs
 *
 * Zero dependencies (plain fetch + a hand-rolled ABI decoder for the one
 * return shape we need), so it runs without a yarn install. Idempotent:
 * transcripts are cached by CID — re-running only fetches new/changed
 * episodes. Output:
 *
 *   transcripts/index.json        — per-episode metadata (slug, name, date,
 *                                   AI title/one-liner, participants, CIDs)
 *   transcripts/<slug>.json       — the raw transcript JSONL from IPFS
 *   transcripts/<slug>.txt        — rendered "[h:mm:ss] speaker: text" speech
 *                                   only (events like qr/chess/chyron dropped)
 *   transcripts/<slug>.chat.json  — the chat log, when the manifest has one
 *
 * The distillation step that reads these lives in .claude/skills/distill-lessons.
 */

const CONTRACT = "0xf3ce3614fe8cd4294a0bf05d10cfda9d9cbc4886"; // SlopComputer, mainnet
const RPCS = [
  process.env.ETH_RPC_URL,
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
  "https://eth.llamarpc.com",
].filter(Boolean);
const GATEWAY = process.env.IPFS_GATEWAY || "https://media.slop.computer/ipfs";
// cast sig "episodeCount()" / "getEpisodes(uint256,uint256)"
const SEL_COUNT = "0x6be153ae";
const SEL_GET = "0xa75cd791";

const OUT = new URL("../transcripts/", import.meta.url).pathname;

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

async function ethCall(data) {
  let lastErr;
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: CONTRACT, data }, "latest"],
        }),
      });
      const body = await res.json();
      if (body.error) throw new Error(`${rpc}: ${body.error.message}`);
      return body.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// --- minimal ABI decoding for getEpisodes' (bytes32,string,string,string,string,address,uint,uint,bytes32)[] ---
const word = (hex, i) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
const num = w => parseInt(w, 16);
const str = (hex, byteOff) => {
  const w0 = byteOff / 32;
  const len = num(word(hex, w0));
  const bytes = hex.slice(2 + (w0 + 1) * 64, 2 + (w0 + 1) * 64 + len * 2);
  return Buffer.from(bytes, "hex").toString("utf8");
};

function decodeEpisodes(hex) {
  const arrOff = num(word(hex, 0)); // bytes
  const arrBase = arrOff / 32;
  const n = num(word(hex, arrBase));
  const dataStart = (arrBase + 1) * 32; // byte offset tuple offsets are relative to
  const episodes = [];
  for (let i = 0; i < n; i++) {
    const tupOff = dataStart + num(word(hex, arrBase + 1 + i));
    const t = tupOff / 32;
    const f = j => word(hex, t + j);
    episodes.push({
      id: "0x" + f(0),
      name: str(hex, tupOff + num(f(1))),
      slug: str(hex, tupOff + num(f(2))),
      liveSlug: str(hex, tupOff + num(f(3))),
      manifest: str(hex, tupOff + num(f(4))),
      datetime: num(f(6)),
    });
  }
  return episodes;
}

const gw = ipfsUrl => `${GATEWAY}/${ipfsUrl.replace(/^ipfs:\/\//, "")}`;

/** Render the raw JSONL to "[h:mm:ss] speaker: text" — spoken lines only.
 *  Speech events have no `kind`; everything with a kind (qr, chess, chyron,
 *  music, …) is a screen event, not something anyone said. */
function renderTxt(jsonl) {
  const lines = [];
  let t0 = null;
  for (const raw of jsonl.split("\n")) {
    if (!raw.trim()) continue;
    let d;
    try {
      d = JSON.parse(raw);
    } catch {
      continue;
    }
    if (d.kind || !d.text) continue;
    t0 ??= d.ts;
    const s = Math.floor((d.ts - t0) / 1000);
    const stamp = `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    lines.push(`[${stamp}] ${d.handle || d.anonId || d.address || "?"}: ${d.text}`);
  }
  return lines.join("\n") + "\n";
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// --- main ---
mkdirSync(OUT, { recursive: true });
const indexPath = join(OUT, "index.json");
const prior = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : {};

const count = num(await ethCall(SEL_COUNT));
const arg = n => n.toString(16).padStart(64, "0");
const episodes = decodeEpisodes(await ethCall(SEL_GET + arg(0) + arg(count)));
console.log(`${count} episodes on-chain`);

const index = {};
for (const ep of episodes) {
  const entry = { ...ep };
  index[ep.slug] = entry;
  if (!ep.manifest) {
    console.log(`  ${ep.slug}: no manifest yet (skipped)`);
    continue;
  }
  try {
    const manifest = await fetchJson(gw(ep.manifest));
    entry.meta = manifest.meta ?? null;
    entry.participants = manifest.participants ?? null;
    entry.transcriptCid = manifest.transcript?.cid ?? null;
    entry.chatCid = manifest.chat?.cid ?? null;

    const cached = prior[ep.slug];
    if (entry.transcriptCid) {
      const path = join(OUT, `${ep.slug}.json`);
      const txtPath = join(OUT, `${ep.slug}.txt`);
      if (cached?.transcriptCid === entry.transcriptCid && existsSync(path) && existsSync(txtPath)) {
        console.log(`  ${ep.slug}: cached`);
      } else {
        const t = await fetch(gw(`ipfs://${entry.transcriptCid}`));
        if (!t.ok) throw new Error(`transcript ${t.status}`);
        const jsonl = await t.text();
        writeFileSync(path, jsonl);
        writeFileSync(txtPath, renderTxt(jsonl));
        console.log(`  ${ep.slug}: transcript ✓`);
      }
    } else {
      console.log(`  ${ep.slug}: manifest has no transcript`);
    }
    if (entry.chatCid) {
      const path = join(OUT, `${ep.slug}.chat.json`);
      if (!(cached?.chatCid === entry.chatCid && existsSync(path))) {
        const c = await fetch(gw(`ipfs://${entry.chatCid}`));
        if (c.ok) writeFileSync(path, await c.text());
      }
    }
  } catch (e) {
    console.error(`  ${ep.slug}: FAILED — ${e.message}`);
    entry.error = String(e.message);
  }
}

writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
console.log(`index → transcripts/index.json`);
