"use client";

import React, { type ReactElement, useEffect, useState } from "react";
import { Button, LivePulse } from "~~/components/ui";
import { type Episode, type EpisodeManifest, fetchManifest, formatDate, gatewayUrl, relaySlug } from "~~/types/episode";

const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";

interface EpisodeCardProps {
  episode: Episode;
  isLive?: boolean;
}

// Hls.js is ~120 KB; only pull it in when the homepage actually has a live
// episode to preview. Mirrors the LazyHlsPlayer in app/[slug]/page.tsx.
const LazyHlsPreview = ({ src }: { src: string }) => {
  const [Player, setPlayer] = useState<
    null | ((p: { src: string; className?: string; controls?: boolean }) => ReactElement)
  >(null);
  useEffect(() => {
    let cancelled = false;
    import("~~/components/HlsPlayer").then(mod => {
      if (!cancelled) setPlayer(() => mod.HlsPlayer);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Player) {
    return (
      <div
        className="absolute inset-0 bg-black flex items-center justify-center slop-mono text-xs"
        style={{ color: "var(--slop-text-muted)" }}
      >
        loading stream…
      </div>
    );
  }
  return <Player src={src} className="absolute inset-0 w-full h-full" controls={false} />;
};

// Friendly local-time format for the "going live at …" badge. `0n` collapses
// to "soon!" so an episode reserved without a datetime still gets a CTA. Drops
// the year when it matches now so the badge stays tight.
const formatScheduledTime = (datetime: bigint): string => {
  if (datetime === 0n) return "soon!";
  const d = new Date(Number(datetime) * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return new Intl.DateTimeFormat(undefined, opts).format(d);
};

/**
 * One-row-per-episode card with the unfurl image on the left and meta + title +
 * description + watch button on the right. Used to fill the homepage with a
 * scrollable stack of episodes — each card fetches its own manifest so the
 * description / one-liner can come straight from the AI pass.
 */
export const EpisodeCard = ({ episode, isLive = false }: EpisodeCardProps) => {
  const hasManifest = episode.manifest.length > 0;

  const [manifest, setManifest] = useState<EpisodeManifest | null>(null);
  const [cardOk, setCardOk] = useState(true);
  // Bumps on retry to bust the browser cache for the 404'd card URL — without
  // it, the browser keeps serving the cached 404 even after the host saves
  // the card on live.slop.computer.
  const [cardRetry, setCardRetry] = useState(0);

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

  // While the episode hasn't been finalized, poll for the card to appear —
  // covers the "I had the page open, then disk-saved the card on live" case.
  // Stops as soon as the image loads (cardOk flips true) or the manifest
  // ships (hasManifest, the card url becomes IPFS-anchored).
  useEffect(() => {
    if (hasManifest || cardOk) return;
    const id = setInterval(() => {
      setCardOk(true);
      setCardRetry(n => n + 1);
    }, 15_000);
    return () => clearInterval(id);
  }, [hasManifest, cardOk]);

  // Prefer the AI-generated one-liner as a punchy lead; fall back to the
  // full description. No generic-blurb fallback — the homepage stacks many
  // of these and repeating the same "what is slop.computer" sentence on
  // every card would be noise.
  const description =
    manifest?.meta?.oneLiner?.trim() || manifest?.meta?.description?.trim() || manifest?.description?.trim() || "";
  // Prefer the IPFS-pinned card from the manifest (survives the relay box).
  // Fall back to the live relay's per-room card URL while the episode isn't
  // finalized yet (or for episodes that predate the IPFS pin step). `cardRetry`
  // appends a cache-busting query param so a poll-retry actually re-fetches.
  const cardUrlBase = manifest?.card?.cid
    ? gatewayUrl(`ipfs://${manifest.card.cid}`)
    : `https://live.slop.computer/v1/cards/${encodeURIComponent(relaySlug(episode))}/published.png`;
  const cardUrl = cardRetry > 0 ? `${cardUrlBase}?v=${cardRetry}` : cardUrlBase;

  return (
    <section
      className="relative overflow-hidden p-6 sm:p-10 flex flex-col gap-5"
      style={{
        background:
          "radial-gradient(120% 100% at 0% 0%, rgba(255,62,201,0.18), transparent 60%), radial-gradient(120% 100% at 100% 100%, rgba(124,77,255,0.18), transparent 60%), rgba(10,15,36,0.7)",
        border: isLive ? "1px solid rgba(255, 62, 201, 0.7)" : "1px solid rgba(255, 62, 201, 0.4)",
        borderRadius: 12,
        boxShadow: isLive
          ? "0 0 48px rgba(255, 62, 201, 0.4), 0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div
        className={
          isLive || cardOk ? "grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6" : "flex flex-col"
        }
      >
        {isLive ? (
          <a
            href={`/${episode.slug}`}
            className="relative block overflow-hidden bg-black self-start w-full"
            style={{
              border: "1px solid rgba(255, 62, 201, 0.7)",
              borderRadius: 8,
              boxShadow: "0 0 24px rgba(255, 62, 201, 0.45), 0 8px 24px rgba(0,0,0,0.5)",
              aspectRatio: "16 / 9",
            }}
          >
            <LazyHlsPreview src={HLS_URL} />
            <span
              className="absolute top-2 left-2 inline-flex items-center gap-2 px-2 py-1 slop-mono"
              style={{
                background: "rgba(6, 3, 13, 0.78)",
                border: "1px solid var(--slop-live)",
                borderRadius: 999,
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--slop-live)",
                textShadow: "0 0 8px rgba(255, 62, 201, 0.6)",
                backdropFilter: "blur(4px)",
                pointerEvents: "none",
              }}
            >
              <LivePulse label="Live now" />
            </span>
          </a>
        ) : cardOk ? (
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
            style={{ color: "var(--slop-cyan)" }}
          >
            {episode.datetime !== 0n ? <span>{formatDate(episode.datetime)}</span> : null}
          </div>
          <h2
            className="text-3xl sm:text-5xl uppercase tracking-wide leading-tight m-0"
            style={{ color: "var(--slop-lime)", textShadow: "0 0 16px rgba(188, 255, 91, 0.4)" }}
          >
            {episode.name || "untitled"}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm whitespace-pre-wrap" style={{ color: "var(--slop-text)" }}>
              {description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 items-center">
            {isLive ? (
              <Button as="a" variant="primary" href={`/${episode.slug}`}>
                ▶ Watch live now
              </Button>
            ) : hasManifest ? (
              <Button as="a" variant="primary" href={`/${episode.slug}`}>
                ▶ Watch episode
              </Button>
            ) : (
              <a
                href={`/${episode.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2"
                style={{
                  fontFamily: "var(--slop-font-display)",
                  fontSize: 13,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: "var(--slop-cyan)",
                  background: "rgba(63, 207, 255, 0.10)",
                  border: "1px solid var(--slop-cyan)",
                  borderRadius: 6,
                  textDecoration: "none",
                  boxShadow: "0 0 18px rgba(63, 207, 255, 0.35)",
                  textShadow: "0 0 10px rgba(63, 207, 255, 0.6)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--slop-cyan)",
                    boxShadow: "0 0 8px var(--slop-cyan)",
                    animation: "slop-pulse 1.6s ease-in-out infinite",
                  }}
                />
                going live {formatScheduledTime(episode.datetime)}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EpisodeCard;
