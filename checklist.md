# Going live — operator checklist

The full lifecycle of a slop.computer episode, in the exact order to do it. `goLive` on the contract is **just a pointer flip** — it doesn't start the stream. The stream has to be flowing before you push that button or the audience hits a 404'd HLS player.

Two surfaces involved:

- `live.slop.computer` — the Mac OS 9 desktop where host + guests appear as draggable cam/screen windows. OBS captures this desktop and pushes to MediaMTX.
- `slop.computer` (this repo) — audience-facing front page. Reads the `SlopComputer` contract on mainnet. Flips to `<LiveHero>` when `live != 0x0`.

## Booking the guest

- [ ] Pick a guest and generate a room link on `live.slop.computer/admin`.
- [ ] Copy/paste the link to the guest (or put it on the cal).
- [ ] Follow the link yourself and fire up the **Card** app to generate the guest's card.

## Reserve the slug on slop.computer

Register the episode on-chain ahead of time so `slop.computer/<slug>` resolves to a placeholder page — gives you a real URL to share in the tweet / cal invite, and means the audience can pre-load the page.

- [ ] On `slop.computer/admin` → **Add a future episode** form, fill in `name`, `slug` (e.g. `ep-1`), and (optional) datetime. Submit.
- [ ] Tx is `addEpisode(name, slug, "", 0x0, unix)` — empty manifest, zero contract addr, no live pointer touched.
- [ ] Confirm `slop.computer/<slug>` loads the placeholder. You now have a shareable URL.

## Schedule the YouTube broadcast

- [ ] YouTube Studio → **Create** → **Go Live** → **Manage** → **Schedule** → **Select previous one** → reuse everything, then swap in the new card.

## Promote

- [ ] (Optional) Fire off a tweet announcing the show — date, time, guest, link.

## Day of — ~1 hour before the show

- [ ] Drop the guest into the **research app** and run a full pass. Skim the output for good questions to ask on air.

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

## 2. Flip the front page live

Step 1's HLS sanity check has passed, so the stream is genuinely producing segments — flip the front page live now and the `slop.computer` audience is watching straight away. Fanouts to external platforms come *after* this (Step 3); the audience-facing surface is the priority once the stream is verified healthy.

**Still do not reach this step until Step 1 passed.** If `index.m3u8` isn't producing segments, flipping the contract live just shows the audience a buffering player.

Two paths depending on whether you already reserved the slug ahead of the show:

### 2a. If you already scheduled the episode (recommended)

The slug is already on-chain from the **Reserve the slug** step. Just flip the live pointer:

- [ ] In `/admin` → find the row in the episode table → click **◉ Go Live** inline on that row. Calls `setLive(id)`. One tx, no fields to re-enter.

### 2b. If you're going live cold (no pre-scheduled entry)

In `/admin` → **Start a new live show** form:

- [ ] `name` — episode title (e.g. `ep 003 · agents and the death of the email signup`)
- [ ] `slug` — auto-filled from name; must match `[a-z0-9-]{1,64}`. This is the URL: `slop.computer/<slug>`.
- [ ] `contract` — per-episode contract or `0x0000…0000` if there isn't one.
- [ ] `datetime` — local time of the show.
- [ ] Submit → calls `goLive(name, slug, "", contractAddr, unix)` (add + setLive in one tx). `manifest` is intentionally empty for now (audience watches the HLS stream, not IPFS).

On chain:

- A new Episode is pushed to the head of the linked list.
- `live` pointer is set to that episode's id.
- `episodeCount` increments.

The homepage polls every 30s; within 30s of the tx confirming, visitors flip from the brand page to `<LiveHero>` with the HLS player + live chat. `/<slug>` also resolves and renders the live player.

## 3. Start the fanouts (YouTube, Twitch, X, Kick)

With the `slop.computer` audience already watching (Step 2), now re-publish to the external platforms. OBS pushes **once** to MediaMTX. The relay then re-publishes that stream to external destinations via ffmpeg children (`-c copy`, no transcode) so the stream keys never leave the box. UI is on `live.slop.computer/admin` → Fanouts panel (this repo's /admin doesn't have it).

- [ ] In `live.slop.computer/admin` → **Fanouts** panel, hit **Start** next to **YouTube Live**. (Same flow for Twitch / X / Kick if you're sending there too.)
- [ ] Confirm the destination shows `running` and pop YouTube Studio open to verify the ingest is healthy before announcing.

Notes / gotchas:

- Stream keys live in the relay's env (`YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `TWITTER_STREAM_KEY`, `KICK_STREAM_KEY`). If a destination shows `not configured`, that env is missing.
- **X / Twitter** keys are per-broadcast — regenerate in `studio.x.com → Producer` before each show.
- **If OBS drops and reconnects** (like it just did), the fanout ffmpeg children exit because their RTMP source vanished. The registry entry is cleared by the exit handler. **Re-Start each fanout** from the Fanouts panel after OBS comes back, or YouTube goes silent for the rest of the show.

## 4. Run the show

- Audience watches at `slop.computer` (or any `/<slug>` share link).
- Chat is the SIWE-gated live chat on the right rail, talking to the relay.
- MediaMTX keeps writing the recording to disk.

## 5. End the show

The `<FinalizePanel>` has an episode picker and stays visible whether or not an episode is live, so you can finalize before *or* after `goOffline()` — and re-finalize a past episode any time. Finalizing while still live is the smooth path, but it's no longer load-bearing.

- [ ] In `live.slop.computer/admin` → **Stop** each running fanout. Stopping these *before* OBS gives YouTube/etc. a clean disconnect; if you stop OBS first the ffmpeg children just error out when the RTMP source vanishes.
- [ ] **Stop OBS publishing.** MediaMTX closes the fmp4 recording on disk.
- [ ] In `/admin` → **Finalize** panel → confirm the **episode** picker is on the right show (defaults to the live one, else the latest).
- [ ] **Check recording** (`GET /admin/recording` on the relay). Confirms the latest file size + mtime.
- [ ] **Pin to IPFS** (`POST /admin/finalize?slug=<slug>` — the panel adds the slug so the relay pins *that episode's* chat + transcript, not the `debug` room). Streams NDJSON progress phases the UI renders via `LoadingBar`:
  - `starting` — total bytes known
  - `remuxing` — fmp4 → mp4 (indeterminate bar; no byte progress)
  - `uploading` — bytes / total to local kubo
  - `pinning-manifest` — pinning the JSON manifest
  - `done` — returns `cid` (video) and `manifestCid` (JSON with video CID + description + participants + files + chat)
- [ ] **Save manifest on-chain** → `setManifest(episode.id, "ipfs://" + manifestCid)`. One tx from the owner wallet.
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
| Manifest is missing transcript / description / one-liner | `/admin/finalize` ran without `?slug=`, so the relay finalized the `debug` room (empty transcript → no transcript pin, AI meta pass skipped) | Re-finalize: pick the episode in the Finalize panel and **Pin to IPFS** again, then **Save manifest**. The panel now always sends the slug. |
| `goLive` reverts | Slug collision (`slugToId` already has it), or not the owner | Pick a fresh slug; confirm wallet is contract owner. |
