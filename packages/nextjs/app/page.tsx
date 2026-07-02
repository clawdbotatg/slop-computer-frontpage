"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NextPage } from "next";
import { EpisodeCard } from "~~/components/EpisodeCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { SLOP_CHAIN_ID, isZeroEpisode } from "~~/types/episode";

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
    chainId: SLOP_CHAIN_ID,
    watch: false,
    query: READ_QUERY,
  });

  const { data: episodes, isLoading } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "getEpisodes",
    args: [0n, PAGE_SIZE],
    chainId: SLOP_CHAIN_ID,
    watch: false,
    query: READ_QUERY,
  });

  const isLive = !isZeroEpisode(liveEpisode);
  const liveId = isLive ? liveEpisode?.id : null;
  const allEpisodes = episodes ?? [];

  if (!isLive && allEpisodes.length === 0 && !isLoading) {
    return <BrandHomepage />;
  }

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-10">
      <Hero />

      {/* Stack every fetched episode as a full card — newest first. The live
          episode (if any) keeps its natural slot in the list but renders an
          inline HLS preview + LIVE NOW badge + "Watch live now" CTA via the
          isLive prop. */}
      {allEpisodes.length > 0 ? (
        <section className="flex flex-col gap-10">
          {allEpisodes.map(ep => (
            <EpisodeCard key={ep.id} episode={ep} isLive={Boolean(liveId && ep.id === liveId)} />
          ))}
        </section>
      ) : null}
    </div>
  );
};

const BrandHomepage = () => (
  <div className="flex-1 w-full max-w-4xl mx-auto px-4 pt-12 sm:pt-20 pb-12 flex flex-col gap-14 sm:gap-20">
    <Hero />
    <EpisodesLoader />
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
  "You're right. I've been confidently wrong twice already.",
  "Let me actually verify, not guess.",
  "You're right to be pissed",
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

// The locally-installed monospace names render the box-drawing glyphs cleanly
// where present (macOS/Windows); generic `monospace` is the universal floor.
const ASCII_FONT_STACK = "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', 'Consolas', monospace";

// useLayoutEffect on the server warns; fall back to useEffect during SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * The ANSI-Shadow wordmark is live monospace text. The naive way to make it
 * responsive — shrink font-size to fit (the old `calc(... / 110)` approach) —
 * breaks on small screens: at a 3–5px font-size the fine ╔═╗ box-drawing lines
 * can't be rasterized, AND each glyph's advance is rounded to the pixel grid
 * independently, so the error accumulates across all 102 columns and the right
 * end ("COMPUTER") collapses into overlapping mush.
 *
 * Instead we render the block ONCE at a fixed, legible 16px — where every
 * column aligns cleanly — then apply a single CSS transform to scale the whole
 * pre-aligned block down to fit its container. Uniform scaling downsamples a
 * crisp raster instead of re-rasterizing tiny glyphs, so the columns stay
 * locked at any width. We never scale past 1 (16px is the design ceiling).
 */
const AsciiWordmark = () => {
  // `fit` fills the available width; `block` is the natural-size wordmark.
  const fitRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ scale: number; height: number } | null>(null);

  useIsoLayoutEffect(() => {
    const fit = fitRef.current;
    const block = blockRef.current;
    if (!fit || !block) return;
    const measure = () => {
      const available = fit.clientWidth;
      const naturalWidth = block.scrollWidth;
      // Bail on a zero-width read (block not laid out yet) — the ResizeObserver
      // below watches `block`, so it'll re-fire the moment it gains real size.
      if (!naturalWidth || !available) return;
      const scale = Math.min(1, available / naturalWidth);
      setBox({ scale, height: block.scrollHeight * scale });
    };
    measure();
    // Observe BOTH the container (width changes → rescale) AND the block
    // itself. The block observer is what makes this self-healing: if the
    // first synchronous measure reads a stale/zero size (e.g. a layout race
    // on the loading→BrandHomepage remount), it fires again the instant the
    // block's real dimensions land, so we never get stuck unscaled.
    const ro = new ResizeObserver(measure);
    ro.observe(fit);
    ro.observe(block);
    // Local fonts make glyph metrics available immediately, but re-measure
    // once fonts settle as cheap insurance against a metric shift.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={fitRef}
      aria-hidden
      className="w-full min-w-0 overflow-hidden flex justify-center"
      // Collapse the layout box to the SCALED height; otherwise the shrunken
      // block reserves its full unscaled height and leaves a gap underneath.
      style={{ height: box ? `${box.height}px` : undefined }}
    >
      <div
        ref={blockRef}
        style={{
          fontFamily: ASCII_FONT_STACK,
          fontSize: "16px",
          lineHeight: 1,
          whiteSpace: "pre",
          color: "var(--slop-magenta)",
          textAlign: "left",
          transform: box ? `scale(${box.scale})` : undefined,
          transformOrigin: "top center",
          // Stay invisible until measured so the full-size, unscaled block
          // never paints and gets clipped by the centered overflow-hidden
          // container (the ".OP.COMPUT" middle-slice bug). measure() runs in
          // useLayoutEffect before paint, so in the normal path this resolves
          // within the same frame — no visible delay.
          visibility: box ? "visible" : "hidden",
        }}
      >
        {SLOP_ASCII}
      </div>
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

      {/* Logo mark sitting to the left of the ASCII wordmark. Stacks on
          mobile, sits side-by-side from sm up. */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 w-full min-w-0">
        {/* The retro-CRT-with-Ethereum-logo mark, recolored to the magenta
            brand color (logo-mark-pink.png — generated from the source by
            mapping the black ink to magenta and dropping the white fill to
            transparent, so it reads as pink line art). drop-shadow adds the
            same faint glow the wordmark has. */}
        <img
          src="/logo-mark-pink.png"
          alt=""
          aria-hidden
          width={192}
          height={192}
          className="w-16 h-16 sm:w-24 sm:h-24 shrink-0 object-contain"
          style={{ filter: "drop-shadow(0 0 10px rgba(255, 62, 201, 0.35))" }}
        />

        <AsciiWordmark />
      </div>

      <ThinkingBlock />

      <p
        className="max-w-4xl text-base sm:text-lg slop-mono leading-relaxed"
        style={{ color: "var(--slop-text)", textTransform: "none" }}
      >
        an onchain podcast for technical humans building with ai:
        <br />
        the cypherpunks, the sloperators, the forward deployed context goblins.
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

// Replaces the old "coming soon…" empty state with a loader that reads as if
// we're still fetching from chain. Reuses the SPARKLE_FRAMES sparkle (same as
// ThinkingBlock) plus animated trailing dots so it feels alive.
const EpisodesLoader = () => {
  const [frame, setFrame] = useState(0);
  const [dots, setDots] = useState(1);

  useEffect(() => {
    const sparkle = setInterval(() => setFrame(f => (f + 1) % SPARKLE_FRAMES.length), 150);
    return () => clearInterval(sparkle);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setDots(d => (d % 3) + 1), 450);
    return () => clearInterval(tick);
  }, []);

  return (
    <section
      className="flex justify-center"
      style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)", paddingTop: 32 }}
    >
      <div className="slop-mono text-sm sm:text-base" style={{ textTransform: "none" }}>
        <span style={{ color: "var(--slop-cyan)" }}>{SPARKLE_FRAMES[frame]}</span>
        <span style={{ color: "var(--slop-text)" }}> loading episodes from smart contract</span>
        <span style={{ color: "var(--slop-cyan)" }}>{".".repeat(dots)}</span>
      </div>
    </section>
  );
};

export default Home;
