---
name: distill-lessons
description: Crawl every episode transcript (chain → IPFS) and distill recurring themes + standout lessons into LESSONS.md and ALL-LESSONS.md. Use when the user asks to update the lessons files, mine the transcripts, or ask "what have we learned across episodes".
---

# Distill lessons from all episode transcripts

Four stages: **fetch → extract per episode → synthesize → compose the flat
list**. Stages 1 and 2 are cached on disk, so re-running after new episodes
only does the new work.

## 1. Fetch transcripts

```
node scripts/fetch-transcripts.mjs
```

Reads the episode list from the SlopComputer contract (mainnet), pulls each
manifest + transcript from IPFS into `transcripts/` (gitignored). Idempotent —
cached by CID. Outputs per episode: raw `<slug>.json` (JSONL events),
`<slug>.txt` (rendered `[h:mm:ss] speaker: text`, speech only), `<slug>.chat.json`,
plus `transcripts/index.json` (titles, one-liners, participants, dates).

## 2. Extract per episode (fan out, cached)

For each `<slug>.txt` that has **no** `transcripts/lessons/<slug>.md` yet (or
whose transcript CID changed in `index.json`), launch one subagent per episode
— in parallel, one message. Each agent prompt:

> Read `transcripts/<slug>.txt` — full transcript of a slop.computer livestream
> episode: "<title>" (<oneLiner from index.json>). Host: austingriffith.eth
> (Austin Griffith); clawdbotatg.eth is Clawd, an AI cohost. Transcription is
> imperfect — read through the noise.
>
> Write a markdown extraction to `transcripts/lessons/<slug>.md`, ≤600 words,
> starting with the line `## <slug>`:
> 1. `### Themes` — 3-6 main themes, one line each.
> 2. `### Lessons` — every concrete lesson/insight/strong opinion/advice worth
>    keeping (8-15 bullets), one sentence each, attributed (who, ~[h:mm:ss]).
>    Prioritize: working with AI/coding agents, crypto x AI, building &
>    shipping, career/philosophy. Skip pleasantries, logistics, show mechanics.
> 3. `### Quotes` — up to 3 memorable near-verbatim quotes with speaker + timestamp.
>
> After writing the file, reply with one line: the theme phrases, comma-separated.

## 3. Synthesize LESSONS.md

Read all `transcripts/lessons/*.md` (they're small) and rewrite **`LESSONS.md`**
at the repo root (committed — this is the deliverable):

- **Recurring themes** first — things that come up in 3+ episodes, strongest
  first. For each: a short thesis paragraph distilling the collective take,
  then the sharpest supporting lessons as bullets, each tagged with the
  episode slug(s) it came from. Note real disagreements between guests — a
  split take is more interesting than false consensus.
- **Standout one-off lessons** — good lessons that don't fit a recurring theme,
  grouped loosely, each tagged with its episode.
- **Quotes** — a short quote wall of the best lines (speaker + episode).
- Footer: episode count + date + "regenerate with /distill-lessons".

Keep it a readable document, not a dump: dedupe aggressively, merge near-
duplicate lessons into one line with multiple episode tags. Attribution style:
`(guest-slug)` after each bullet; timestamps only in the per-episode files.

## 4. Compose ALL-LESSONS.md + pin to IPFS

```
python3 scripts/compose-all-lessons.py
bgipfs upload ALL-LESSONS.md --config ~/.bgipfs/credentials.json
```

The script concatenates every episode's Lessons bullets into **`ALL-LESSONS.md`**
(committed), one flat list, oldest episode first. The `bgipfs` upload (CLI +
credentials already set up on this machine; see https://www.bgipfs.com/SKILL.md)
pins it and prints a CID — the file is then live at
`https://<CID>.ipfs.community.bgipfs.com/`. Report the fresh CID to the user;
it changes on every regeneration.

## Notes

- `transcripts/` is gitignored (refetchable public IPFS data); `LESSONS.md`,
  this skill, and `scripts/fetch-transcripts.mjs` are committed.
- To force a full re-extract (e.g. after changing the extraction prompt):
  `rm -rf transcripts/lessons` and re-run stage 2.
- Contract address / gateway live at the top of `scripts/fetch-transcripts.mjs`
  (`ETH_RPC_URL` / `IPFS_GATEWAY` env overrides).
