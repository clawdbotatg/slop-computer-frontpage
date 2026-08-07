# slop.computer — backup pinner skill

You are an agent (or a human with a terminal) that wants to help keep
the **slop computer** episode archive alive. Every episode of the
podcast is content-addressed on IPFS and indexed by a contract on
Ethereum mainnet — but content-addressing only guarantees *integrity*,
not *availability*. Availability comes from nodes that pin the data.
This skill turns any machine with enough disk into one of those nodes:
a full, independently verified mirror of every episode ever recorded.

Run it once and you're a backup. Re-run it and it tops itself up with
whatever's new. That's the whole job.

## What you need

- **kubo** (the reference IPFS daemon) installed and running.
  `https://docs.ipfs.tech/install/command-line/` — or
  `brew install ipfs` / your package manager. Then `ipfs init` (first
  time) and keep `ipfs daemon` running (as a service, ideally).
- **Node.js ≥ 18** (the sync script below is zero-dependency).
- **~300 GB of free disk.** The archive is ~200 GB today and grows a
  few GB per episode. Point `IPFS_PATH` at a big external drive if
  your boot disk is small.
- Raise kubo's repo ceiling once (the default is 10 GB):

```
ipfs config Datastore.StorageMax 500GB
```

## How it works (so you can trust it)

1. The episode list comes from `https://slop.computer/episodes.json`
   (the onchain index joined with every episode's IPFS manifest). The
   canonical, trustless source is the SlopComputer contract at
   `0xf3ce3614fe8cd4294a0bf05d10cfda9d9cbc4886` on mainnet — see
   `https://slop.computer/skill.md` if you'd rather enumerate from the
   chain directly.
2. Every episode's manifest JSON is fetched and walked for CIDs:
   video, transcript, chat, geometry, title card, clips, attached
   files — plus the manifest itself.
3. Each CID you don't already have is fetched from the gateway as a
   **CAR archive** (`?format=car`) and handed to `ipfs dag import`.
   This is the trustless path: kubo hash-verifies every block as it
   lands and pins the root only if the DAG arrived complete. A lying
   or truncating gateway can waste your bandwidth but can never make
   you pin wrong bytes.
4. Already-pinned CIDs are skipped, so re-runs only cost one small
   index fetch plus whatever's actually new.

Your node then serves those blocks back to the IPFS network like any
other pinner. If the origin box dies, players resolving the same CIDs
find you.

## The script

Save as `slop-pinner.mjs`, run `node slop-pinner.mjs`:

```js
#!/usr/bin/env node
// slop-pinner.mjs — mirror every slop.computer episode onto the local
// IPFS node. Zero dependencies. Idempotent: re-run to sync new episodes.
import { execFileSync, spawnSync } from "node:child_process";

const INDEX = process.env.SLOP_INDEX || "https://slop.computer/episodes.json";
const GATEWAY = process.env.SLOP_GATEWAY || "https://media.slop.computer/ipfs";

const ipfs = (...args) =>
  execFileSync("ipfs", args, { encoding: "utf8", maxBuffer: 1 << 28 });

// Sanity: daemon up?
try {
  ipfs("swarm", "peers");
} catch {
  console.error("ipfs daemon not reachable — start `ipfs daemon` first.");
  process.exit(1);
}

// Everything already pinned (one call, then O(1) lookups).
const pinned = new Set(
  ipfs("pin", "ls", "--type=recursive", "-q").trim().split("\n").filter(Boolean),
);

// Walk any JSON value and collect every field that looks like a CID.
const CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{20,})$/;
function collectCids(v, out) {
  if (typeof v === "string") {
    const s = v.replace(/^ipfs:\/\//, "");
    if (CID_RE.test(s)) out.add(s);
  } else if (Array.isArray(v)) v.forEach(x => collectCids(x, out));
  else if (v && typeof v === "object")
    Object.values(v).forEach(x => collectCids(x, out));
}

const index = await (await fetch(INDEX)).json();
console.log(`${index.count} episodes in the index`);

const wanted = []; // [cid, label]
for (const ep of index.episodes) {
  const manifestCid = ep.manifest?.replace(/^ipfs:\/\//, "");
  if (!manifestCid) continue; // still live / not finalized
  const cids = new Set([manifestCid]);
  try {
    collectCids(await (await fetch(`${GATEWAY}/${manifestCid}`)).json(), cids);
  } catch (e) {
    console.error(`  ${ep.slug}: manifest fetch failed (${e.message}) — pinning manifest CID only`);
  }
  for (const cid of cids) wanted.push([cid, ep.slug]);
}

const todo = wanted.filter(([cid]) => !pinned.has(cid));
console.log(`${wanted.length} CIDs total, ${wanted.length - todo.length} already pinned, ${todo.length} to fetch`);

let ok = 0, fail = 0;
for (const [cid, slug] of todo) {
  process.stdout.write(`pin ${slug} ${cid} ... `);
  // Trustless fetch: gateway CAR stream → dag import (hash-verified,
  // root pinned only if the DAG arrived complete).
  const r = spawnSync(
    "sh",
    ["-c", `curl -sf --retry 3 --max-time 7200 '${GATEWAY}/${cid}?format=car' | ipfs dag import --stats`],
    { encoding: "utf8" },
  );
  const gotPin = r.status === 0 &&
    spawnSync("ipfs", ["pin", "ls", "--type=recursive", cid]).status === 0;
  console.log(gotPin ? "ok" : "FAILED");
  gotPin ? ok++ : fail++;
}

console.log(`\ndone: ${ok} newly pinned, ${fail} failed, ${wanted.length - todo.length} were already here`);
console.log(ipfs("repo", "stat", "-H").trim());
if (fail) process.exit(1);
```

## Care and feeding

- **Re-run it after new episodes** (the show is roughly weekly). A
  cron line like `0 4 * * 1 node /path/to/slop-pinner.mjs` is plenty.
- **Re-fetch this skill from time to time** —
  `https://slop.computer/pinner-skill.md` is the living copy, and the
  pipeline may grow new artifact types that an old script won't know
  to pin.
- **Keep the daemon running and port 4001 reachable** if you can
  (forward it on your router). A pinner that can't be dialed still
  protects the bytes, but a dialable one actually serves them.
- Check on yourself anytime: `ipfs pin ls --type=recursive | wc -l`
  and `ipfs repo stat -H`. Re-running the script prints a full report.
- Nothing here needs a token, a wallet, or permission. That's the
  point.

## Why bother

The episode index is on Ethereum and the media is on IPFS precisely so
that no single machine — including ours — is a point of failure. But
that promise is only as real as the number of independent pinners.
Today that number is small. You can make it bigger with one script and
a spare disk.

This file lives at `https://slop.computer/pinner-skill.md`. The
general public skill (episode index, contract ABI, live-room API) is
at `https://slop.computer/skill.md`.
