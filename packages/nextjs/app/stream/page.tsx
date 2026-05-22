"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { HlsPlayer } from "~~/components/HlsPlayer";

// Standalone HLS preview. Lets the host visit a real URL and see whether
// MediaMTX is producing segments BEFORE clicking ◉ Go Live — the .m3u8
// itself isn't playable in a browser (downloads as text), so this page
// wraps it in hls.js. Public on purpose: the HLS endpoint is already
// public, this just makes it consumable.
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";

const StreamPreview: NextPage = () => (
  <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-4">
    <header className="flex flex-wrap items-center gap-3">
      <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
        {"// stream preview"}
      </div>
      <h1
        className="m-0 uppercase leading-tight"
        style={{
          color: "var(--slop-text)",
          fontFamily: "var(--slop-font-display)",
          fontSize: "clamp(20px, 3.6vw, 30px)",
          textShadow: "0 0 12px rgba(255, 62, 201, 0.45)",
        }}
      >
        Live stream
      </h1>
      <Link href="/admin" className="slop-link slop-mono text-[11px] ml-auto">
        → /admin
      </Link>
    </header>

    <div
      className="overflow-hidden bg-black"
      style={{
        border: "1px solid rgba(255, 62, 201, 0.4)",
        boxShadow: "0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        borderRadius: 8,
      }}
    >
      <HlsPlayer src={HLS_URL} className="aspect-video" />
    </div>

    <div
      className="flex flex-wrap items-center gap-3 text-[11px] slop-mono"
      style={{ color: "var(--slop-text-muted)" }}
    >
      <span>source:</span>
      <a href={HLS_URL} target="_blank" rel="noreferrer" className="slop-link break-all">
        {HLS_URL}
      </a>
    </div>

    <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
      {"// if the player errors or sits at a black frame for >15s, OBS isn't pushing — start (or restart) it. "}
      {"the audience-facing slop.computer page only flips to a live player after you click ◉ Go Live in /admin, "}
      {"but the stream itself runs whenever OBS is publishing to MediaMTX."}
    </p>
  </div>
);

export default StreamPreview;
