#!/usr/bin/env bash
# Extract podcast audio from a pinned episode video, on the slop server.
#
#   ./extract-audio.sh <slug> <manifestCid>
#
# Reads the episode manifest off the local IPFS node, pulls the video's audio
# track out (stream-copy to .m4a when it's AAC, else mp3 128k), pins the audio,
# and appends a result line to ~/podcast-audio/results.jsonl:
#
#   {"slug":..,"manifestCid":..,"audioCid":..,"sizeBytes":..,"durationSec":..,"format":..}
#
# Idempotent: a slug already in results.jsonl is skipped. Designed to be called
# per-episode by the backfill loop AND by the slop-computer-live finishing
# pipeline for new episodes.
set -euo pipefail

SLUG="$1"; MANIFEST_CID="$2"
OUT=~/podcast-audio
mkdir -p "$OUT"
RESULTS="$OUT/results.jsonl"

if [ -f "$RESULTS" ] && grep -q "\"manifestCid\":\"$MANIFEST_CID\"" "$RESULTS"; then
  echo "$SLUG: already done, skipping"
  exit 0
fi

VIDEO_CID=$(ipfs cat "$MANIFEST_CID" | jq -r '.video.cid')
if [ -z "$VIDEO_CID" ] || [ "$VIDEO_CID" = "null" ]; then
  echo "$SLUG: no video cid in manifest $MANIFEST_CID" >&2
  exit 1
fi

TMP="$OUT/.tmp-$SLUG.mp4"
trap 'rm -f "$TMP"' EXIT
echo "$SLUG: fetching video $VIDEO_CID ..."
ipfs get -o "$TMP" "$VIDEO_CID" >/dev/null

CODEC=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$TMP")
if [ "$CODEC" = "aac" ]; then
  AUDIO="$OUT/$SLUG.m4a"; FORMAT="audio/mp4"
  ffmpeg -y -v error -i "$TMP" -vn -c:a copy -movflags +faststart "$AUDIO"
else
  AUDIO="$OUT/$SLUG.mp3"; FORMAT="audio/mpeg"
  ffmpeg -y -v error -i "$TMP" -vn -c:a libmp3lame -b:a 128k "$AUDIO"
fi

DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUDIO" | cut -d. -f1)
SIZE=$(stat -c%s "$AUDIO")
AUDIO_CID=$(ipfs add -Q --pin=true "$AUDIO")

jq -nc --arg slug "$SLUG" --arg m "$MANIFEST_CID" --arg a "$AUDIO_CID" \
  --argjson size "$SIZE" --argjson dur "$DURATION" --arg fmt "$FORMAT" \
  '{slug:$slug, manifestCid:$m, audioCid:$a, sizeBytes:$size, durationSec:$dur, format:$fmt}' >> "$RESULTS"
echo "$SLUG: audio $AUDIO_CID (${SIZE} bytes, ${DURATION}s, $CODEC->$FORMAT)"
