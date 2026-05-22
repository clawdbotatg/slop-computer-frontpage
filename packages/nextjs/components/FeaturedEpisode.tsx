"use client";

import React, { useEffect, useState } from "react";
import { Button } from "~~/components/ui";
import { type Episode, type EpisodeManifest, ZERO_ADDRESS, fetchManifest, formatDate } from "~~/types/episode";

interface FeaturedEpisodeProps {
  episode: Episode;
  episodeNumber: number;
}

const shortAddr = (addr: string) => (addr === ZERO_ADDRESS ? null : `${addr.slice(0, 6)}…${addr.slice(-4)}`);

// Shown only when the episode has no manifest description yet (still live, or
// finalized without one). A real description from the manifest takes priority.
const FALLBACK_BLURB =
  "slop.computer is an onchain podcast about agents, builders, and the messy reality of shipping software in 2026. every episode is pinned to ipfs and indexed on ethereum mainnet.";

/**
 * Hero for the offline state — hypes the most-recent episode with a big
 * watch CTA. The button links to the per-episode page `/[slug]`, which
 * fetches the manifest JSON and embeds the video player itself.
 *
 * Pulls the manifest here too so the offline homepage shows the episode's
 * own description (post-finalize) instead of the generic blurb, and the
 * per-room card image as the preview.
 */
export const FeaturedEpisode = ({ episode, episodeNumber }: FeaturedEpisodeProps) => {
  const contractShort = shortAddr(episode.contractAddr);
  const hasManifest = episode.manifest.length > 0;

  const [manifest, setManifest] = useState<EpisodeManifest | null>(null);
  const [cardOk, setCardOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!episode.manifest) {
      setManifest(null);
      return;
    }
    fetchManifest(episode.manifest).then(m => {
      if (!cancelled) setManifest(m);
    });
    return () => {
      cancelled = true;
    };
  }, [episode.manifest]);

  const description = manifest?.description?.trim() || FALLBACK_BLURB;
  const cardUrl = `https://live.slop.computer/v1/cards/${encodeURIComponent(episode.slug)}/published.png`;

  return (
    <section
      className="relative overflow-hidden p-6 sm:p-10 flex flex-col gap-5"
      style={{
        background:
          "radial-gradient(120% 100% at 0% 0%, rgba(255,62,201,0.18), transparent 60%), radial-gradient(120% 100% at 100% 100%, rgba(124,77,255,0.18), transparent 60%), rgba(10,15,36,0.7)",
        border: "1px solid rgba(255, 62, 201, 0.4)",
        borderRadius: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className={cardOk ? "grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6" : "flex flex-col"}>
        {cardOk ? (
          <a
            href={`/${episode.slug}`}
            className="block overflow-hidden bg-black self-start w-full"
            style={{
              border: "1px solid rgba(255, 62, 201, 0.4)",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              aspectRatio: "16 / 9",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl}
              alt={`${episode.name || "episode"} preview`}
              onError={() => setCardOk(false)}
              className="block w-full h-full object-cover"
            />
          </a>
        ) : null}

        <div className="flex flex-col gap-5">
          <div
            className="flex flex-wrap items-center gap-3 text-[11px] slop-mono"
            style={{ color: "var(--slop-text-muted)" }}
          >
            <span style={{ color: "var(--slop-accent)" }}>◆ latest episode</span>
            <span>·</span>
            <span>ep.{String(episodeNumber).padStart(3, "0")}</span>
            <span>·</span>
            <span>{formatDate(episode.datetime)}</span>
            {contractShort ? (
              <>
                <span>·</span>
                <a
                  href={`https://etherscan.io/address/${episode.contractAddr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="slop-link"
                >
                  contract {contractShort}
                </a>
              </>
            ) : null}
          </div>
          <h1
            className="text-3xl sm:text-5xl uppercase tracking-wide leading-tight m-0"
            style={{ color: "var(--slop-text)", textShadow: "0 0 16px rgba(255, 62, 201, 0.4)" }}
          >
            {episode.name || "untitled"}
          </h1>
          <p className="max-w-2xl text-sm whitespace-pre-wrap" style={{ color: "var(--slop-text)" }}>
            {description}
          </p>
          <div className="flex flex-wrap gap-3 items-center">
            <Button as="a" variant="primary" href={`/${episode.slug}`}>
              {hasManifest ? "▶ Watch episode" : "▶ Episode page"}
            </Button>
            {!hasManifest ? (
              <span className="text-xs slop-mono" style={{ color: "var(--slop-text-muted)" }}>
                {"// recording publishing soon"}
              </span>
            ) : null}
            <span className="text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
              {"// next live show: tba"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturedEpisode;
