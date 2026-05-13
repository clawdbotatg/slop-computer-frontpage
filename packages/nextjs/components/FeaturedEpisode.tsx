"use client";

import React from "react";
import { Button } from "~~/components/ui";
import { type Episode, ZERO_ADDRESS, formatDate, isIpfsUrl, watchUrl } from "~~/types/episode";

interface FeaturedEpisodeProps {
  episode: Episode;
  episodeNumber: number;
}

const shortAddr = (addr: string) => (addr === ZERO_ADDRESS ? null : `${addr.slice(0, 6)}…${addr.slice(-4)}`);

/**
 * Hero for the offline state — hypes the most-recent episode with a big
 * watch CTA. Pulls the IPFS recording when available; falls back to the
 * raw url otherwise.
 */
export const FeaturedEpisode = ({ episode, episodeNumber }: FeaturedEpisodeProps) => {
  const ipfs = isIpfsUrl(episode.url);
  const contractShort = shortAddr(episode.contractAddr);
  const hasUrl = episode.url.length > 0;

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
      <p className="max-w-2xl text-sm" style={{ color: "var(--slop-text)" }}>
        slop.computer is an onchain podcast about agents, builders, and the messy reality of shipping software in 2026.
        every episode is pinned to ipfs and indexed on ethereum mainnet.
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        {hasUrl ? (
          <Button as="a" variant="primary" href={watchUrl(episode.url)} target="_blank" rel="noreferrer">
            {ipfs ? "▶ Watch episode" : "▶ Open"}
          </Button>
        ) : (
          <span className="text-xs slop-mono" style={{ color: "var(--slop-text-muted)" }}>
            {"// recording publishing soon"}
          </span>
        )}
        <span className="text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
          {"// next live show: tba"}
        </span>
      </div>
    </section>
  );
};

export default FeaturedEpisode;
