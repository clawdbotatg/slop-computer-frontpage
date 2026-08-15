# slop.computer as a classic podcast

How the show gets into Apple Podcasts / Spotify / every podcast app, and how it
stays there with zero extra work per episode.

## How it works

Podcast apps need three things we didn't have: an audio file per episode (our
episodes are ~3 GB videos), an RSS feed, and square cover art. Everything else
(titles, descriptions, dates, per-episode art, durations) already lives in the
on-chain episode manifests.

- **Audio** — `scripts/extract-audio.sh` runs on the slop server (ssh host
  `slopcomputer`), where the videos are already local IPFS blocks. It reads an
  episode manifest, pulls the video, stream-copies the AAC track to a ~70 MB
  `.m4a` (no re-encode, seconds per episode; falls back to mp3 128k for
  non-AAC), pins the audio to the same IPFS node, and appends a line to
  `~/podcast-audio/results.jsonl`. Idempotent by manifest CID.
- **Feed** — `yarn feed` (= `scripts/fetch-transcripts.mjs` +
  `scripts/build-feed.mjs`) reads the chain, the manifests (cached under
  `transcripts/manifests/`), and `scripts/audio-map.json`, and writes
  `packages/nextjs/public/feed.xml`. The feed rides the normal three-surface
  deploy (Vercel + IPFS + ENS). Canonical URL: **https://slop.computer/feed.xml**.
- **Cover art** — `packages/nextjs/public/podcast-cover.png`, 3000×3000,
  derived from `og.jpg`.
- Episode GUIDs are the manifest CIDs (immutable, content-addressed — ideal).
  Enclosures are served from `media.slop.computer/ipfs/<cid>` (verified: HTTP
  206 byte-ranges + HEAD, which Apple requires). `itunes:explicit` is `true` —
  39 of the first 42 transcripts contain profanity; claiming clean gets shows
  pulled, claiming explicit costs nothing.

## Per-episode pipeline (new episodes)

After an episode's manifest is pinned and `addEpisode` lands on chain:

1. On the server: `./extract-audio.sh <slug> <manifestCid>` (in `~ubuntu/`).
2. Copy the new `results.jsonl` line into `scripts/audio-map.json` here
   (`{"<slug>": {"cid": <audioCid>, "sizeBytes": …, "durationSec": …, "format": …}}`).
3. `yarn feed`, commit, deploy the site.

Better long-term (not built yet): teach the finalize flow in slop-computer-live
(`packages/relay/src/recordings.ts` — the block that builds `manifestJson`
after `pinning-manifest`) to also extract audio and write an
`audio: { cid, sizeBytes, durationSec, format }` field into the manifest. The
stitched mp4 is already on local disk there, so it's one
`ffmpeg -vn -c:a copy -movflags +faststart` + one `pinFileToLocalIpfs` call.
`build-feed.mjs` already prefers `manifest.audio` over the map, so the map
becomes legacy the moment that ships — steps 1–2 above disappear and
publishing an episode is just `yarn feed` + deploy (or a cron that notices a
new episode on chain and does it).

## One-time directory submissions (needs the human)

Validate first: https://podba.se/validate + https://castfeedvalidator.com.

1. **Apple Podcasts Connect** (podcastsconnect.apple.com, any Apple ID) —
   submit `https://slop.computer/feed.xml`. Apple emails a verification to the
   feed's owner email (`austin.griffith@ethereum.org`). Review takes 1–5 days.
   Overcast, Castro, and most indie apps mirror Apple automatically.
2. **Spotify for Creators** (creators.spotify.com) — "add your podcast", paste
   the feed URL, verify by emailed code.
3. **YouTube Music** (studio.youtube.com → RSS ingest) — optional; makes audio
   episodes appear as static-image videos.
4. **Amazon Music** (music.amazon.com/podcasts → submit RSS).
5. **Podcast Index** (podcastindex.org/add) — free form; lights up the
   Podcasting 2.0 app ecosystem (Fountain, Podverse, TrueFans).

## Later / nice-to-have

- `<podcast:transcript>` tags — we have full transcripts on IPFS; needs a
  JSONL→VTT conversion + pin per episode.
- `<podcast:person>` for hosts/guests, `<podcast:liveItem>` announcing the live
  HLS stream when `isLive` flips, `<podcast:chapters>` from the clips data.
- Listen badges (Apple/Spotify) on the front page once the directories approve.
