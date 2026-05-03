"use client";

import React from "react";
import { Bevel, Button, Window } from "~~/components/ui";

export type Episode = {
  title: string;
  date: string;
  duration: string;
  description: string;
  cid: string;
};

interface EpisodesGridProps {
  episodes: readonly Episode[] | undefined;
  isLoading: boolean;
}

const BGIPFS_GATEWAY = process.env.NEXT_PUBLIC_BGIPFS_GATEWAY || "https://community.bgipfs.com/ipfs";
const ipfsUrl = (cid: string) => `${BGIPFS_GATEWAY}/${cid}`;

const EpisodeCard = ({ episode, index }: { episode: Episode; index: number }) => {
  return (
    <Window title={`ep.${String(index).padStart(3, "0")} ◆ ${episode.title}`} className="flex flex-col">
      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="text-base leading-tight" style={{ color: "var(--slop-text)" }}>
          {episode.title}
        </h3>
        <div className="flex items-center gap-3 text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
          <span>◆ {episode.date}</span>
          <span>● {episode.duration}</span>
        </div>
        <p className="text-sm flex-1" style={{ color: "var(--slop-text)" }}>
          {episode.description}
        </p>
        <Bevel
          variant="in"
          className="p-2 text-[10px] slop-mono break-all"
          style={{ background: "var(--slop-bg)", color: "var(--slop-text-muted)" }}
        >
          ipfs://{episode.cid}
        </Bevel>
        <Button as="a" href={ipfsUrl(episode.cid)} target="_blank" rel="noreferrer" variant="primary">
          ▶ Watch
        </Button>
      </div>
    </Window>
  );
};

const SkeletonCard = () => (
  <Window title="loading…">
    <div className="p-4 space-y-3">
      <Bevel variant="in" className="h-5 w-3/4" style={{ background: "var(--slop-bg)" }} />
      <Bevel variant="in" className="h-3 w-1/2" style={{ background: "var(--slop-bg)" }} />
      <Bevel variant="in" className="h-16 w-full" style={{ background: "var(--slop-bg)" }} />
      <Bevel variant="in" className="h-9 w-full" style={{ background: "var(--slop-bg)" }} />
    </div>
  </Window>
);

export const EpisodesGrid = ({ episodes, isLoading }: EpisodesGridProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!episodes || episodes.length === 0) {
    return (
      <Window title="no episodes yet">
        <div className="p-8 text-center flex flex-col gap-2 items-center">
          <span className="text-2xl" aria-hidden>
            ◆
          </span>
          <h3 className="text-base">No episodes yet</h3>
          <p className="text-xs slop-mono" style={{ color: "var(--slop-text-muted)" }}>
            Check back soon — episodes will appear here once published onchain.
          </p>
        </div>
      </Window>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {episodes.map((ep, i) => (
        <EpisodeCard key={`${i}-${ep.cid}`} episode={ep} index={i} />
      ))}
    </div>
  );
};
