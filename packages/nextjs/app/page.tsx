"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { EpisodeList } from "~~/components/EpisodeList";
import { FeaturedEpisode } from "~~/components/FeaturedEpisode";
import { LiveHero } from "~~/components/LiveHero";
import { Button } from "~~/components/ui";
import externalContracts from "~~/contracts/externalContracts";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { isZeroEpisode } from "~~/types/episode";

// Tuned for the off-air → live transition. Host calls goLive from /admin
// in one tab and expects the slop.computer tab to flip without a reload.
// 10s polling is the worst case; refetchOnWindowFocus catches the common
// case (switching tabs back) immediately.
const READ_QUERY = { refetchInterval: 10000, refetchOnWindowFocus: true } as const;
const PAGE_SIZE = 24n;
const CONTRACT_ADDRESS = externalContracts[1].SlopComputer.address;
const ENS_NAME = "slopcomputer.eth";
const ENS_URL = `https://app.ens.domains/${ENS_NAME}`;
const ETHERSCAN_URL = `https://etherscan.io/address/${CONTRACT_ADDRESS}`;

/**
 * Canonical "ANSI Shadow" figlet rendering of `SLOP.COMPUTER` — straight
 * from the `figlet` npm package's textSync. All 6 rows are exactly 103
 * chars wide, so every column lines up. Don't hand-edit; regenerate via
 * `figlet.textSync("SLOP.COMPUTER", { font: "ANSI Shadow" })` if it
 * ever needs to change.
 */
// Note the leading + trailing `\n`. Without them, JSX whitespace between
// `<pre>` and `{SLOP_ASCII}` gets prepended to row 1 and shifts it right
// of the other rows.
const SLOP_ASCII = `
███████╗██╗      ██████╗ ██████╗  ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗   ██╗████████╗███████╗██████╗
██╔════╝██║     ██╔═══██╗██╔══██╗██╔════╝██╔═══██╗████╗ ████║██╔══██╗██║   ██║╚══██╔══╝██╔════╝██╔══██╗
███████╗██║     ██║   ██║██████╔╝██║     ██║   ██║██╔████╔██║██████╔╝██║   ██║   ██║   █████╗  ██████╔╝
╚════██║██║     ██║   ██║██╔═══╝ ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║   ██║   ██║   ██╔══╝  ██╔══██╗
███████║███████╗╚██████╔╝██║██╗  ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ╚██████╔╝   ██║   ███████╗██║  ██║
╚══════╝╚══════╝ ╚═════╝ ╚═╝╚═╝   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝      ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
`;

const Home: NextPage = () => {
  const { data: liveEpisode } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "liveEpisode",
    watch: false,
    query: READ_QUERY,
  });

  const { data: episodeCount } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "episodeCount",
    watch: false,
    query: READ_QUERY,
  });

  const { data: episodes, isLoading } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "getEpisodes",
    args: [0n, PAGE_SIZE],
    watch: false,
    query: READ_QUERY,
  });

  const total = episodeCount !== undefined ? Number(episodeCount) : undefined;
  const isLive = !isZeroEpisode(liveEpisode);
  const featuredEpisode = isLive ? liveEpisode : episodes?.[0];
  const featuredId = featuredEpisode?.id;
  const pastEpisodes = (episodes ?? []).filter(ep => ep.id !== featuredId);
  const pastTopNumber = total !== undefined ? total - 2 : undefined;

  if (!isLive && !featuredEpisode) {
    return <BrandHomepage />;
  }

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-10">
      {isLive && liveEpisode ? (
        <LiveHero episode={liveEpisode} />
      ) : featuredEpisode ? (
        <>
          {/* Off-air: keep the slop.computer brand (ASCII title + logo) on
              top of the page above the featured episode. When live, the
              episode title takes the brand slot inside LiveHero. */}
          <Hero />
          <FeaturedEpisode episode={featuredEpisode} episodeNumber={(total ?? 1) - 1} />
        </>
      ) : null}

      {pastEpisodes.length > 0 || isLoading ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-base sm:text-lg uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
              {isLive ? "Past episodes" : "Older episodes"}
            </h2>
            <span className="text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
              {total !== undefined ? `${total} pinned to ipfs` : "loading…"}
            </span>
          </div>
          <EpisodeList
            episodes={pastEpisodes}
            isLoading={isLoading && pastEpisodes.length === 0}
            topNumber={pastTopNumber}
          />
        </section>
      ) : null}
    </div>
  );
};

const BrandHomepage = () => (
  <div className="flex-1 w-full max-w-4xl mx-auto px-4 pt-12 sm:pt-20 pb-12 flex flex-col gap-14 sm:gap-20">
    <Hero />
    <Manifesto />
  </div>
);

const Hero = () => {
  // HEAD-probe /logo.png on mount; only render the <img> when the file
  // actually exists. Avoids the broken-image-icon flash that happens when
  // we render the <img> first and then react to onError.
  const [hasLogo, setHasLogo] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/logo.png", { method: "HEAD" })
      .then(r => {
        if (!cancelled) setHasLogo(r.ok);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="flex flex-col items-center text-center gap-6 sm:gap-8">
      {hasLogo ? (
        <div
          className="relative w-full max-w-[320px] aspect-square"
          style={{
            filter: "drop-shadow(0 0 24px rgba(255, 62, 201, 0.45)) drop-shadow(0 0 64px rgba(124, 77, 255, 0.25))",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="slop.computer — ethereum CRT mascot"
            className="block w-full h-full"
            style={{ objectFit: "contain", imageRendering: "pixelated" }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(0,0,0,0.25) 2px, rgba(0,0,0,0.25) 3px)",
              mixBlendMode: "multiply",
            }}
          />
        </div>
      ) : null}

      {/* sr-only heading for screen readers + SEO; the visible mark is the
          ANSI Shadow ASCII block. Following the ethskills.com recipe: a
          plain <div> with white-space:pre (not <pre>, which has browser
          defaults that throw off rendering), line-height 1.15 to keep rows
          from cramming, and a font stack starting with SF Mono — its
          box-drawing glyphs render perfectly with no subpixel seams. */}
      <h1 className="sr-only">slop.computer</h1>
      <div
        aria-hidden
        className="m-0 mx-auto"
        style={{
          fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', monospace",
          // ASCII block is 103 chars wide. Same scaling formula as
          // ethskills: take the available width, divide by char count.
          fontSize: "clamp(0.3rem, calc((100vw - 3rem) / 110), 1rem)",
          lineHeight: 1,
          whiteSpace: "pre",
          color: "var(--slop-magenta)",
          // CRITICAL: parent has text-center which CSS-inherits into here.
          // With white-space:pre that centers EACH LINE individually, and
          // since SF Mono's `█` / `═` glyphs are very-slightly different
          // widths, lines with different mixes end up with different left
          // edges. Pinning textAlign: left + width: fit-content anchors all
          // rows to the same column; the parent's items-center then
          // centers the block as a whole.
          textAlign: "left",
          width: "fit-content",
        }}
      >
        {SLOP_ASCII}
      </div>

      <p
        className="max-w-3xl text-base sm:text-lg slop-mono leading-relaxed"
        style={{ color: "var(--slop-text)", textTransform: "none" }}
      >
        an onchain podcast for technical humans building with ai:
        <br />
        the sloperators, the dorkestrators, the clawdoggers.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <Button as="a" variant="primary" href={ENS_URL} target="_blank" rel="noreferrer">
          ◆ Follow {ENS_NAME}
        </Button>
        <Button as="a" href={ETHERSCAN_URL} target="_blank" rel="noreferrer">
          Watch the contract ↗
        </Button>
      </div>
    </section>
  );
};

const Manifesto = () => (
  <section
    className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)] gap-3 md:gap-8 items-start"
    style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)", paddingTop: 32 }}
  >
    <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
      {"// manifesto"}
    </div>
    <div
      className="flex flex-col gap-3 text-sm sm:text-base slop-mono leading-relaxed"
      style={{ color: "var(--slop-text)", textTransform: "none" }}
    >
      <p>
        every episode is content-addressed — pinned to ipfs, indexed on ethereum mainnet, registered in a singly-linked
        list on the slop computer contract.
      </p>
      <p>
        when the show is live, the player and the chat <em>are</em> this page. sign in with your wallet, drop a hot
        take, hang out with other listeners. when the show is off the air, the recording lives forever on ipfs.
      </p>
      <p style={{ color: "var(--slop-text-muted)" }}>
        no app to install. no email signup. no algorithm. one contract, a couple of cids, and people who ship.
      </p>
    </div>
  </section>
);

export default Home;
