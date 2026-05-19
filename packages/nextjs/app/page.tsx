"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { EpisodeList } from "~~/components/EpisodeList";
import { FeaturedEpisode } from "~~/components/FeaturedEpisode";
import { LiveHero } from "~~/components/LiveHero";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { isZeroEpisode } from "~~/types/episode";

// Tuned for the off-air → live transition. Host calls goLive from /admin
// in one tab and expects the slop.computer tab to flip without a reload.
// 10s polling is the worst case; refetchOnWindowFocus catches the common
// case (switching tabs back) immediately.
const READ_QUERY = { refetchInterval: 10000, refetchOnWindowFocus: true } as const;
const PAGE_SIZE = 24n;

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

// The most-cited Claude verbal tics, cross-referenced across The
// Register, Hacker News, BigGo, Nautilus, Will Francis's AI-tells
// guide, BlogPros, the arxiv "Rise of Verbal Tics in LLMs" paper,
// and direct user observation. "You're absolutely right!" was said
// 12× in a single thread (per The Register). "It's not X, it's Y."
// is the most-documented structural tic across all sources.
const ANNOYING_PHRASES = [
  "You're absolutely right!",
  "Let me actually look instead of just saying so.",
  "There it is.",
  "Fair.",
  "It's not X, it's Y.",
  "It's half this and half that.",
  "Honestly, I'm not sure.",
  "Great question!",
  "I apologize for the confusion.",
  "Got it.",
  "It's worth noting that…",
  "Let that sink in.",
  "Boom.",
  "Let's run a quick smoke test.",
  "Making a belt-and-suspenders fix.",
];

// Claude Code's terminal thinking indicator cycles a sparkle through a
// few star glyphs to create a shimmer. ~150ms/frame is the sweet spot
// — fast enough to feel alive, slow enough not to look spazzy.
const SPARKLE_FRAMES = ["✳", "✶", "✻", "✷"];

// Effort tiers escalate with each phrase swap — the joke is that the
// more cringe the phrase, the more "effort" Claude is supposedly using.
// First 5 are user-spec'd; after that we just keep ramping until we
// top out at "infinite effort".
const EFFORT_TIERS = [
  "some effort",
  "high effort",
  "xhigh effort",
  "super high effort",
  "hella effort",
  "ultra effort",
  "max effort",
  "galaxy-brain effort",
  "unhinged effort",
  "godlike effort",
  "biblical effort",
  "cosmic effort",
  "transcendent effort",
  "metaphysical effort",
  "infinite effort",
];

const ThinkingBlock = () => {
  // Staged intro:
  //   stage 0 → "Thinking…" for 3s (the authentic Claude Code opener)
  //   stage 1 → "You're absolutely right!" for 7–8s (the king tic, gets a long dwell)
  //   stage 2+ → random rotation through ANNOYING_PHRASES every 5–10s
  const [phrase, setPhrase] = useState("Thinking…");
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const sparkle = setInterval(() => setFrame(f => (f + 1) % SPARKLE_FRAMES.length), 150);
    return () => clearInterval(sparkle);
  }, []);

  useEffect(() => {
    let duration: number;
    if (stage === 0) {
      setPhrase("Thinking…");
      duration = 3000;
    } else if (stage === 1) {
      setPhrase("You're absolutely right!");
      duration = 7000 + Math.random() * 1000;
    } else {
      setPhrase(prev => {
        let candidate = prev;
        // Spin until we pick something different from what's currently shown,
        // so we never see the same phrase twice in a row.
        while (candidate === prev && ANNOYING_PHRASES.length > 1) {
          candidate = ANNOYING_PHRASES[Math.floor(Math.random() * ANNOYING_PHRASES.length)];
        }
        return candidate;
      });
      duration = 5000 + Math.random() * 5000;
    }
    const t = setTimeout(() => setStage(s => s + 1), duration);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <div className="slop-mono text-sm sm:text-base" style={{ textTransform: "none" }}>
      <span style={{ color: "var(--slop-cyan)" }}>{SPARKLE_FRAMES[frame]}</span>
      <span style={{ color: "var(--slop-cyan)" }}> {phrase}</span>
      <span style={{ color: "var(--slop-text-muted)" }}>
        {" "}
        ({elapsed}s · thinking with {EFFORT_TIERS[Math.min(stage, EFFORT_TIERS.length - 1)]})
      </span>
    </div>
  );
};

const Hero = () => {
  return (
    <section className="flex flex-col items-center text-center gap-6 sm:gap-8 pt-8 sm:pt-16">
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

      <ThinkingBlock />

      <p
        className="max-w-4xl text-base sm:text-lg slop-mono leading-relaxed"
        style={{ color: "var(--slop-text)", textTransform: "none" }}
      >
        an onchain podcast for technical humans building with ai:
        <br />
        the sloperators, the clawdoggers, the forward deployed context goblins.
      </p>

      <p
        className="max-w-4xl text-base sm:text-lg slop-mono leading-relaxed pt-1"
        style={{ color: "var(--slop-purple)", textTransform: "none" }}
      >
        join the psychosis to build our way out of the permanent underclass.
      </p>
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
