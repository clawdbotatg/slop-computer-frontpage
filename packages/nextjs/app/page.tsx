"use client";

import type { NextPage } from "next";
import { EpisodesGrid } from "~~/components/EpisodesGrid";
import { LiveBanner } from "~~/components/LiveBanner";
import { Button, Window } from "~~/components/ui";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const LIVE_URL = process.env.NEXT_PUBLIC_LIVE_URL || "https://live.slop.computer";
const SOURCE_URL = "https://github.com/clawdbotatg/slop-computer-frontpage";

const READ_QUERY = { refetchInterval: 30000, refetchOnWindowFocus: false } as const;

const Home: NextPage = () => {
  const { data: isLive } = useScaffoldReadContract({
    contractName: "SlopComputerFrontpage",
    functionName: "isLive",
    watch: false,
    query: READ_QUERY,
  });

  const { data: liveTitle } = useScaffoldReadContract({
    contractName: "SlopComputerFrontpage",
    functionName: "liveTitle",
    watch: false,
    query: READ_QUERY,
  });

  const { data: liveHlsUrl } = useScaffoldReadContract({
    contractName: "SlopComputerFrontpage",
    functionName: "liveHlsUrl",
    watch: false,
    query: READ_QUERY,
  });

  const { data: episodes, isLoading } = useScaffoldReadContract({
    contractName: "SlopComputerFrontpage",
    functionName: "getEpisodes",
    watch: false,
    query: READ_QUERY,
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-8">
      <Window title="welcome.txt" titleRight={<span className="text-[10px] slop-mono opacity-60">readme</span>}>
        <div className="px-6 py-7 flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl tracking-tight">
            <span style={{ color: "var(--slop-accent)" }}>◆</span> slop.
            <span style={{ color: "var(--slop-text-muted)" }}>computer</span>
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "var(--slop-text)" }}>
            An onchain podcast about agents, builders, and the messy reality of shipping software in 2026. Episodes are
            pinned to IPFS, indexed on Ethereum mainnet, and never go offline.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button as="a" variant="primary" href={LIVE_URL} target="_blank" rel="noreferrer">
              Enter Desktop ▸
            </Button>
            <Button as="a" href={SOURCE_URL} target="_blank" rel="noreferrer">
              View Source ▸
            </Button>
          </div>
        </div>
      </Window>

      <LiveBanner isLive={isLive} liveTitle={liveTitle} liveHlsUrl={liveHlsUrl} />

      <section id="episodes" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="text-xl">Episodes</h2>
          <span className="text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
            {episodes ? `${episodes.length} pinned to IPFS` : "loading…"}
          </span>
        </div>
        <EpisodesGrid episodes={episodes} isLoading={isLoading} />
      </section>
    </div>
  );
};

export default Home;
