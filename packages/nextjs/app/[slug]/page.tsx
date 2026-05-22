"use client";

import { type ReactElement, use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { Chat } from "~~/components/Chat";
import { LiveTranscript } from "~~/components/LiveTranscript";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import {
  type Episode,
  type EpisodeManifest,
  ZERO_ADDRESS,
  ZERO_BYTES32,
  fetchManifest,
  formatDate,
  gatewayUrl,
  isZeroEpisode,
} from "~~/types/episode";

const READ_QUERY = { refetchInterval: 5000, refetchOnWindowFocus: false } as const;
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-episode page. Resolves `/<slug>` against the contract's `slugToId`
 * mapping (O(1) view), reads the episode struct, then fetches the manifest
 * JSON from IPFS to populate description / participants / files / etc.
 *
 * Live: if `liveEpisode == ep.id` we ignore the manifest and embed the live
 * HLS player.
 * VOD : embed a plain `<video controls src=ipfsGatewayUrl>` so seeking,
 * range requests, and the existing browser controls all work — no hls.js
 * needed for a non-fragmented mp4 sitting behind a path gateway.
 */
const EpisodePage: NextPage<PageProps> = ({ params }) => {
  const { slug } = use(params);

  // `isFetched` (not `isLoading`) is the SSR-safe gate: during the server
  // render the query hasn't run yet, so `isLoading` is `false` AND `data`
  // is `undefined` — the old check fired `notFound()` and Vercel returned
  // a 404 status with our not-found.tsx body before the client ever
  // hydrated. `isError` covers the other side: `getEpisodeBySlug` reverts
  // (doesn't return zero) when the slug isn't registered, so we treat the
  // revert as "not found" too.
  const {
    data: episode,
    isFetched,
    isError,
  } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "getEpisodeBySlug",
    args: [slug],
    query: READ_QUERY,
  });

  const { data: liveId } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "live",
    query: READ_QUERY,
  });

  if (isError) return notFound();
  if (isFetched && (!episode || isZeroEpisode(episode as Episode))) return notFound();

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8">
      <div
        className="flex flex-wrap items-center gap-2 text-[11px] slop-mono"
        style={{ color: "var(--slop-text-muted)" }}
      >
        <Link href="/" className="slop-link">
          ← slop.computer
        </Link>
      </div>
      {episode && !isZeroEpisode(episode as Episode) ? (
        <EpisodeBody episode={episode as Episode} isLive={(liveId ?? ZERO_BYTES32) === (episode as Episode).id} />
      ) : (
        <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
          loading…
        </p>
      )}
    </div>
  );
};

const EpisodeBody = ({ episode, isLive }: { episode: Episode; isLive: boolean }) => {
  const [manifest, setManifest] = useState<EpisodeManifest | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [vodFailed, setVodFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isLive || !episode.manifest) {
      setManifest(null);
      return;
    }
    setManifestLoading(true);
    fetchManifest(episode.manifest)
      .then(m => {
        if (!cancelled) setManifest(m);
      })
      .finally(() => {
        if (!cancelled) setManifestLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [episode.manifest, isLive]);

  const videoCid = manifest?.video?.cid;
  const videoSrc = isLive ? HLS_URL : videoCid ? gatewayUrl(`ipfs://${videoCid}`, `${episode.slug}.mp4`) : null;
  // When there's no playable video yet (scheduled episode pre-finalize) OR the
  // VOD failed to load, fall back to the per-room card image the live relay
  // publishes — same PNG that's used for og:image. If the card 404s (host
  // hasn't saved it yet) we hide the <img> and the underlying text placeholder
  // shows through.
  const showCardFallback = !isLive && (!videoSrc || vodFailed);
  const cardUrl = `https://live.slop.computer/v1/cards/${encodeURIComponent(episode.slug)}/published.png`;
  const contractShort =
    episode.contractAddr && episode.contractAddr !== ZERO_ADDRESS
      ? `${episode.contractAddr.slice(0, 6)}…${episode.contractAddr.slice(-4)}`
      : null;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div
          className="flex flex-wrap items-center gap-3 text-[11px] slop-mono"
          style={{ color: "var(--slop-text-muted)" }}
        >
          {isLive ? <span style={{ color: "var(--slop-lime)" }}>● LIVE</span> : null}
          <span>{formatDate(episode.datetime)}</span>
          <span>·</span>
          <span>/{episode.slug}</span>
          {contractShort ? (
            <>
              <span>·</span>
              <a
                href={`https://etherscan.io/address/${episode.contractAddr}`}
                target="_blank"
                rel="noreferrer"
                className="slop-link"
              >
                {contractShort}
              </a>
            </>
          ) : null}
        </div>
        <h1
          className="m-0 uppercase tracking-wide leading-tight text-3xl sm:text-5xl"
          style={{ color: "var(--slop-text)", textShadow: "0 0 16px rgba(255, 62, 201, 0.4)" }}
        >
          {episode.name || "untitled"}
        </h1>
      </header>

      <div className="flex flex-col gap-4">
        <div
          className="overflow-hidden bg-black relative"
          style={{
            border: "1px solid rgba(255, 62, 201, 0.4)",
            boxShadow: "0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            borderRadius: 8,
            aspectRatio: "16 / 9",
          }}
        >
          {videoSrc && (!showCardFallback || isLive) ? (
            isLive ? (
              // Dynamic import so the live HLS bundle isn't pulled into the page when not needed.
              <LazyHlsPlayer src={videoSrc} />
            ) : (
              <video
                src={videoSrc}
                controls
                playsInline
                onError={() => setVodFailed(true)}
                className="block w-full h-full"
              />
            )
          ) : (
            <>
              <PlayerPlaceholder
                label={
                  manifestLoading
                    ? "Loading manifest…"
                    : episode.manifest
                      ? "Manifest is missing video.cid"
                      : "Recording publishing soon"
                }
              />
              {showCardFallback ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardUrl}
                    alt=""
                    onError={e => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    className="absolute inset-0 block w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                    <span
                      className="slop-mono uppercase flex items-center gap-3 px-5 py-3"
                      style={{
                        fontSize: "clamp(16px, 3.4vw, 30px)",
                        letterSpacing: "0.12em",
                        fontFamily: "var(--slop-font-display)",
                        color: "var(--slop-text)",
                        background: "rgba(6, 3, 13, 0.82)",
                        border: "1px solid rgba(255, 62, 201, 0.55)",
                        borderRadius: 999,
                        backdropFilter: "blur(6px)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                        textShadow: "0 0 16px rgba(255, 62, 201, 0.45)",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "var(--slop-magenta)",
                          boxShadow: "0 0 12px var(--slop-magenta)",
                          animation: "slop-pulse 1.6s ease-in-out infinite",
                          flexShrink: 0,
                        }}
                      />
                      Stream coming soon…
                    </span>
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>

        <aside
          className="flex flex-col h-[520px]"
          style={{
            border: "1px solid rgba(255, 62, 201, 0.4)",
            background: "rgba(10, 15, 36, 0.85)",
            borderRadius: 8,
            backdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          <div
            className="px-3 py-2 text-[11px] uppercase tracking-wide"
            style={{
              background: "linear-gradient(180deg, var(--slop-magenta) 0%, var(--slop-magenta-dim) 100%)",
              color: "#fff",
              fontFamily: "var(--slop-font-display)",
            }}
          >
            {isLive ? "▣ Live chat" : "▣ Chat archive (coming soon)"}
          </div>
          <div className="flex-1 min-h-0">
            {isLive ? <Chat slug={episode.slug} /> : <ChatArchivePlaceholder cid={manifest?.chat?.cid} />}
          </div>
        </aside>

        {isLive ? (
          <aside
            className="flex flex-col h-[360px]"
            style={{
              border: "1px solid rgba(255, 62, 201, 0.4)",
              background: "rgba(10, 15, 36, 0.85)",
              borderRadius: 8,
              backdropFilter: "blur(12px)",
              overflow: "hidden",
            }}
          >
            <div
              className="px-3 py-2 text-[11px] uppercase tracking-wide flex items-center gap-2"
              style={{
                background: "linear-gradient(180deg, var(--slop-magenta) 0%, var(--slop-magenta-dim) 100%)",
                color: "#fff",
                fontFamily: "var(--slop-font-display)",
              }}
            >
              <span>▣ Live transcript</span>
              <span className="slop-mono text-[10px] opacity-80">
                ({"// from "}
                <code>/v1/transcript</code>)
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <LiveTranscript slug={episode.slug} />
            </div>
          </aside>
        ) : null}

        <div className="flex flex-col gap-3 min-w-0">
          {manifest?.description ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base sm:text-lg uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                About
              </h2>
              <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--slop-text)" }}>
                {manifest.description}
              </p>
            </section>
          ) : null}

          {manifest?.participants && manifest.participants.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                Participants
              </h2>
              <ul className="flex flex-col gap-1">
                {manifest.participants.map(p => (
                  <li key={p.address} className="flex items-center gap-2 text-sm">
                    <Address address={p.address as `0x${string}`} />
                    {p.role ? (
                      <span className="slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
                        {`// ${p.role}`}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {manifest?.links && manifest.links.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                Links
              </h2>
              <ul className="flex flex-col gap-1 text-sm">
                {manifest.links.map(l => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="slop-link">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {manifest?.files && manifest.files.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                Files
              </h2>
              <ul className="flex flex-col gap-1 text-sm slop-mono">
                {manifest.files.map(f => (
                  <li key={f.cid}>
                    <a
                      href={gatewayUrl(`ipfs://${f.cid}`, f.name)}
                      target="_blank"
                      rel="noreferrer"
                      className="slop-link"
                    >
                      {f.name}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {manifest?.transcript?.cid ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                Transcript
              </h2>
              <a
                href={gatewayUrl(`ipfs://${manifest.transcript.cid}`)}
                target="_blank"
                rel="noreferrer"
                className="slop-link slop-mono text-[11px]"
              >
                full transcript ↗
              </a>
            </section>
          ) : null}

          {episode.manifest ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
                Manifest
              </h2>
              <a
                href={gatewayUrl(episode.manifest)}
                target="_blank"
                rel="noreferrer"
                className="slop-link slop-mono text-[11px] break-all"
              >
                {episode.manifest} ↗
              </a>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const PlayerPlaceholder = ({ label }: { label: string }) => (
  <div
    className="flex items-center justify-center w-full h-full slop-mono text-xs"
    style={{ color: "var(--slop-text-muted)" }}
  >
    {label}
  </div>
);

const ChatArchivePlaceholder = ({ cid }: { cid: string | undefined }) => (
  <div className="p-3 slop-mono text-[11px] flex flex-col gap-2" style={{ color: "var(--slop-text-muted)" }}>
    <span>{"// chat persistence not yet wired"}</span>
    {cid ? (
      <a href={gatewayUrl(`ipfs://${cid}`)} target="_blank" rel="noreferrer" className="slop-link">
        raw chat.json ↗
      </a>
    ) : null}
  </div>
);

// Hls.js is ~120 KB; keep it out of the per-episode bundle entirely when the
// episode is a VOD (~99% of page views). We only need it when isLive.
const LazyHlsPlayer = ({ src }: { src: string }) => {
  const [Player, setPlayer] = useState<null | ((p: { src: string; className?: string }) => ReactElement)>(null);
  useEffect(() => {
    let cancelled = false;
    import("~~/components/HlsPlayer").then(mod => {
      if (!cancelled) setPlayer(() => mod.HlsPlayer);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!Player) return <PlayerPlaceholder label="Loading player…" />;
  return <Player src={src} className="aspect-video" />;
};

export default EpisodePage;
