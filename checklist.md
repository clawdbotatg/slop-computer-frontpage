# Going live — operator checklist

The full lifecycle of a slop.computer episode, in the exact order to do it. `goLive` on the contract is **just a pointer flip** — it doesn't start the stream. The stream has to be flowing before you push that button or the audience hits a 404'd HLS player.

Two surfaces involved:

- `live.slop.computer` — the Mac OS 9 desktop where host + guests appear as draggable cam/screen windows. OBS captures this desktop and pushes to MediaMTX.
- `slop.computer` (this repo) — audience-facing front page. Reads the `SlopComputer` contract on mainnet. Flips to `<LiveHero>` when `live != 0x0`.

## Booking the guest

- [ ] Pick a guest and generate them a link on `live.slop.computer/admin`, then get it on the cal.

## Before the show

- [ ] Host signed in via SIWE on `live.slop.computer` (sets the `slop_session` cookie that the relay's `/admin/*` endpoints will gate on later — same cookie works on the `slop.computer` /admin Finalize panel because both subdomains share eTLD+1).
- [ ] Guests invited / joined the desktop. Cam + screen-share windows laid out.
- [ ] OBS scene composed against the `live.slop.computer` desktop.

## 1. Start the stream (OBS → MediaMTX)

- [ ] Start OBS publishing RTMP to `media.slop.computer`. MediaMTX does two things from this one ingest:
  - Serves `https://media.slop.computer/hls/live/index.m3u8` for the audience HLS player.
  - Writes the fmp4 recording to disk on the relay box.
- [ ] Open `https://media.slop.computer/hls/live/index.m3u8` in a tab and confirm it actually plays. Expect ~5–15s before the first segment lands.

**Do not skip the sanity check.** If the HLS endpoint isn't producing segments, flipping the contract live just shows the audience a buffering player.

## 2. Start the fanouts (YouTube, Twitch, X, Kick)

OBS pushes **once** to MediaMTX. The relay then re-publishes that stream to external destinations via ffmpeg children (`-c copy`, no transcode) so the stream keys never leave the box. UI is on `live.slop.computer/admin` → Fanouts panel (this repo's /admin doesn't have it).

- [ ] In `live.slop.computer/admin` → **Fanouts** panel, hit **Start** next to **YouTube Live**. (Same flow for Twitch / X / Kick if you're sending there too.)
- [ ] Confirm the destination shows `running` and pop YouTube Studio open to verify the ingest is healthy before announcing.

Notes / gotchas:

- Stream keys live in the relay's env (`YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `TWITTER_STREAM_KEY`, `KICK_STREAM_KEY`). If a destination shows `not configured`, that env is missing.
- **X / Twitter** keys are per-broadcast — regenerate in `studio.x.com → Producer` before each show.
- **If OBS drops and reconnects** (like it just did), the fanout ffmpeg children exit because their RTMP source vanished. The registry entry is cleared by the exit handler. **Re-Start each fanout** from the Fanouts panel after OBS comes back, or YouTube goes silent for the rest of the show.

## 3. Flip the front page live (contract `goLive`)

In `/admin` on this site → **Go Live** form:

- [ ] `name` — episode title (e.g. `ep 003 · agents and the death of the email signup`)
- [ ] `slug` — auto-filled from name; must match `[a-z0-9-]{1,64}`. This is the URL: `slop.computer/<slug>`.
- [ ] `contract` — per-episode contract or `0x0000…0000` if there isn't one.
- [ ] `datetime` — local time of the show.
- [ ] Submit → calls `goLive(name, slug, "", contractAddr, unix)`. `manifest` is intentionally empty for now (audience watches the HLS stream, not IPFS).

On chain:

- A new Episode is pushed to the head of the linked list.
- `live` pointer is set to that episode's id.
- `episodeCount` increments.

The homepage polls every 30s; within 30s of the tx confirming, visitors flip from the brand page to `<LiveHero>` with the HLS player + live chat. `/<slug>` also resolves and renders the live player.

## 4. Run the show

- Audience watches at `slop.computer` (or any `/<slug>` share link).
- Chat is the SIWE-gated live chat on the right rail, talking to the relay.
- MediaMTX keeps writing the recording to disk.

## 5. End the show — finalize FIRST, then go offline

**Order matters:** the `<FinalizePanel>` in /admin is gated on `liveEpisode != 0x0`. If you call `goOffline()` first, the panel disappears and you have to paste the manifest CID into the per-episode "Save manifest" button manually. Do it in the order below.

- [ ] In `live.slop.computer/admin` → **Stop** each running fanout. Stopping these *before* OBS gives YouTube/etc. a clean disconnect; if you stop OBS first the ffmpeg children just error out when the RTMP source vanishes.
- [ ] **Stop OBS publishing.** MediaMTX closes the fmp4 recording on disk.
- [ ] In `/admin` → **Finalize** panel → **Check recording** (`GET /admin/recording` on the relay). Confirms the latest file size + mtime.
- [ ] **Pin to IPFS** (`POST /admin/finalize`). Streams NDJSON progress phases the UI renders via `LoadingBar`:
  - `starting` — total bytes known
  - `remuxing` — fmp4 → mp4 (indeterminate bar; no byte progress)
  - `uploading` — bytes / total to local kubo
  - `pinning-manifest` — pinning the JSON manifest
  - `done` — returns `cid` (video) and `manifestCid` (JSON with video CID + description + participants + files + chat)
- [ ] **Save manifest on-chain** → `setManifest(liveEpisode.id, "ipfs://" + manifestCid)`. One tx from the owner wallet.
- [ ] **End show (go offline)** → `goOffline()`. Clears the `live` pointer.

Relay auth: the `slop_session` cookie set during the SIWE pre-flight gates `/admin/recording` and `/admin/finalize`. If you get a 401, sign in on `live.slop.computer` with the host wallet first.

## 6. Verify it landed

- [ ] `slop.computer` — brand `<Hero>` is back on top, `<FeaturedEpisode>` shows the finished episode below it.
- [ ] `slop.computer/<slug>` — VOD player loads the manifest, fetches the video CID via gateway, plays in a plain `<video controls>` (no hls.js for VODs).
- [ ] Manifest CID resolves: `https://media.slop.computer/ipfs/<manifestCid>` shows the JSON; `?filename=` on the video CID plays inline.

## Failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Audience sees a buffering player after `goLive` | OBS isn't publishing, or HLS hasn't produced segments yet | Confirm `index.m3u8` plays before pushing the tx. If already live, restart OBS — the contract pointer is fine. |
| YouTube went silent after an OBS reconnect | Fanout ffmpeg exited when MediaMTX's RTMP source vanished and didn't auto-respawn | Re-Start each fanout from `live.slop.computer/admin` → Fanouts. |
| MediaMTX has two recording files after an OBS reconnect | MediaMTX closes the recording on publisher disconnect and opens a fresh one on reconnect | `/admin/finalize` only pins the newest by mtime. Accept the gap, or ssh in and `ffmpeg -f concat` the two before finalize. |
| `Check recording` shows nothing | OBS never published, or MediaMTX recording path is misconfigured | Check MediaMTX config on the relay. |
| `/admin/finalize` returns 401 | Host not signed in to relay via SIWE | Visit `live.slop.computer`, sign in with the owner wallet, retry. |
| FinalizePanel is gone but recording still on disk | You called `goOffline` before finalizing | Pin the recording out-of-band; paste the manifest CID into the per-episode row's "Save manifest" field in the EpisodeTable. |
| `goLive` reverts | Slug collision (`slugToId` already has it), or not the owner | Pick a fresh slug; confirm wallet is contract owner. |
