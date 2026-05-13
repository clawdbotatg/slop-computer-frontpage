"use client";

import React from "react";
import { type Episode, formatDate, isIpfsUrl, watchUrl } from "~~/types/episode";

interface EpisodeListProps {
  episodes: readonly Episode[] | undefined;
  isLoading: boolean;
  /** Episode-number of the newest item. Subsequent rows decrement. */
  topNumber?: number;
}

export const EpisodeList = ({ episodes, isLoading, topNumber }: EpisodeListProps) => {
  if (isLoading) {
    return (
      <ul className="flex flex-col">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-4 px-4 py-3"
            style={{ borderTop: i === 0 ? undefined : "1px dashed rgba(255, 62, 201, 0.18)" }}
          >
            <span className="h-3 w-12" style={{ background: "rgba(255, 62, 201, 0.18)" }} aria-hidden />
            <span className="h-4 flex-1" style={{ background: "rgba(255, 62, 201, 0.12)" }} aria-hidden />
          </li>
        ))}
      </ul>
    );
  }

  if (!episodes || episodes.length === 0) {
    return (
      <div
        className="px-4 py-6 text-center text-xs slop-mono"
        style={{ color: "var(--slop-text-muted)", border: "1px dashed rgba(255, 62, 201, 0.25)" }}
      >
        no past episodes yet
      </div>
    );
  }

  const top = topNumber ?? episodes.length - 1;

  return (
    <ul className="flex flex-col">
      {episodes.map((ep, i) => {
        const epNum = top - i;
        const ipfs = isIpfsUrl(ep.url);
        const hasUrl = ep.url.length > 0;
        return (
          <li
            key={ep.id}
            className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3"
            style={{ borderTop: i === 0 ? undefined : "1px dashed rgba(255, 62, 201, 0.18)" }}
          >
            <span className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
              ep.{String(epNum).padStart(3, "0")}
            </span>
            <span className="slop-mono text-[11px] hidden sm:inline" style={{ color: "var(--slop-text-muted)" }}>
              {formatDate(ep.datetime)}
            </span>
            <span className="truncate text-sm" style={{ color: "var(--slop-text)" }}>
              {ep.name || "untitled"}
            </span>
            {hasUrl ? (
              <a
                href={watchUrl(ep.url)}
                target="_blank"
                rel="noreferrer"
                className="slop-link slop-mono text-[11px] whitespace-nowrap"
              >
                {ipfs ? "▶ watch" : "▶ open"}
              </a>
            ) : (
              <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
                soon
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default EpisodeList;
