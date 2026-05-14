"use client";

import React from "react";
import { Chat } from "~~/components/Chat";
import { HlsPlayer } from "~~/components/HlsPlayer";
import { LivePulse } from "~~/components/ui";
import { type Episode, formatDate } from "~~/types/episode";

interface LiveHeroProps {
  episode: Episode;
}

const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";

/**
 * Hero shown when the contract has a live episode. Player on the left,
 * built-in chat (with SIWE CTA) on the right. Stacks on mobile.
 *
 * The contract's `manifest` field is intentionally ignored while live —
 * playback is always the global HLS endpoint. After the host calls
 * goOffline + setManifest, the episode becomes a VOD and the per-episode
 * page (/[slug]) reads the manifest's video CID.
 */
export const LiveHero = ({ episode }: LiveHeroProps) => {
  const src = HLS_URL;
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <div className="flex flex-col gap-3 min-w-0">
        <header className="flex flex-wrap items-center gap-3">
          <LivePulse label="Live now" />
          <h1
            className="text-2xl sm:text-3xl uppercase tracking-wide leading-tight m-0"
            style={{ color: "var(--slop-text)", textShadow: "0 0 12px rgba(255, 62, 201, 0.45)" }}
          >
            {episode.name || "untitled"}
          </h1>
          <span className="slop-mono text-[11px] ml-auto" style={{ color: "var(--slop-text-muted)" }}>
            ◆ {formatDate(episode.datetime)}
          </span>
        </header>
        <div
          className="overflow-hidden"
          style={{
            border: "1px solid rgba(255, 62, 201, 0.45)",
            boxShadow: "0 0 32px rgba(255, 62, 201, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
            borderRadius: 8,
          }}
        >
          <HlsPlayer src={src} className="aspect-video" />
        </div>
        <div className="flex items-center gap-2 text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
          <span>source:</span>
          <span className="break-all" style={{ color: "var(--slop-text)" }}>
            {src}
          </span>
        </div>
      </div>
      <aside
        className="flex flex-col h-[480px] lg:h-auto lg:min-h-[480px]"
        style={{
          border: "1px solid rgba(255, 62, 201, 0.45)",
          background: "rgba(10, 15, 36, 0.85)",
          borderRadius: 8,
          backdropFilter: "blur(12px)",
          boxShadow: "0 16px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
      >
        <div
          className="px-3 py-2 text-[11px] uppercase tracking-wide flex items-center justify-between"
          style={{
            background: "linear-gradient(180deg, var(--slop-magenta) 0%, var(--slop-magenta-dim) 100%)",
            color: "#fff",
            textShadow: "0 1px 1px rgba(0,0,0,0.4)",
            borderBottom: "1px solid rgba(0,0,0,0.4)",
            fontFamily: "var(--slop-font-display)",
          }}
        >
          <span>▣ Chat — hang out</span>
          <span style={{ opacity: 0.8 }}>{"// live"}</span>
        </div>
        <div className="flex-1 min-h-0">
          <Chat />
        </div>
      </aside>
    </section>
  );
};

export default LiveHero;
