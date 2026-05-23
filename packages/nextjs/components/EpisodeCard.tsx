"use client";

import React, { useEffect, useState } from "react";
import { Button } from "~~/components/ui";
import {
  type Episode,
  type EpisodeManifest,
  ZERO_ADDRESS,
  fetchManifest,
  formatDate,
  gatewayUrl,
} from "~~/types/episode";

interface EpisodeCardProps {
  episode: Episode;
  episodeNumber: number;
}

const shortAddr = (addr: string) => (addr === ZERO_ADDRESS ? null : `${addr.slice(0, 6)}…${addr.slice(-4)}`);

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
export const EpisodeCard = ({ episode, episodeNumber }: EpisodeCardProps) => {
  const contractShort = shortAddr(episode.contractAddr);
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
    : `https://live.slop.computer/v1/cards/${encodeURIComponent(episode.slug)}/published.png`;
  const cardUrl = cardRetry > 0 ? `${cardUrlBase}?v=${cardRetry}` : cardUrlBase;

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
            <span style={{ color: "var(--slop-accent)" }}>ep.{String(episodeNumber).padStart(3, "0")}</span>
            {episode.datetime !== 0n ? (
              <>
                <span>·</span>
                <span>{formatDate(episode.datetime)}</span>
              </>
            ) : null}
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
          <h2
            className="text-3xl sm:text-5xl uppercase tracking-wide leading-tight m-0"
            style={{ color: "var(--slop-text)", textShadow: "0 0 16px rgba(255, 62, 201, 0.4)" }}
          >
            {episode.name || "untitled"}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm whitespace-pre-wrap" style={{ color: "var(--slop-text)" }}>
              {description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 items-center">
            {hasManifest ? (
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
