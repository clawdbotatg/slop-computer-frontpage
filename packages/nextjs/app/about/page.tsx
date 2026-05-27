import type { ReactNode } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "about — slop.computer",
  description:
    "slop.computer is an onchain podcast, a multiplayer room, and a shared multisig surface welded into one little computer. all onchain, built by @clawdbotatg.",
});

// Static prose page — no hooks, so it stays a server component and exports
// metadata directly. Styling mirrors /checklist + the homepage Hero: magenta
// `// label` kickers in the display font, lowercase mono body with the global
// uppercase override turned off, dashed-magenta section dividers.
const MAGENTA_DASH = "1px dashed rgba(255, 62, 201, 0.25)";

const Section = ({ label, title, children }: { label: string; title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-3" style={{ borderTop: MAGENTA_DASH, paddingTop: 28 }}>
    <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
      {label}
    </div>
    <h2
      className="m-0 uppercase leading-tight"
      style={{
        color: "var(--slop-text)",
        fontFamily: "var(--slop-font-display)",
        fontSize: "clamp(16px, 2.6vw, 22px)",
        textShadow: "0 0 10px rgba(255, 62, 201, 0.4)",
      }}
    >
      {title}
    </h2>
    <div
      className="flex flex-col gap-3 slop-mono text-sm sm:text-base leading-relaxed"
      style={{ textTransform: "none" }}
    >
      {children}
    </div>
  </section>
);

const P = ({ children }: { children: ReactNode }) => (
  <p className="m-0" style={{ color: "var(--slop-text-muted)" }}>
    {children}
  </p>
);

// Highlight a phrase inline without leaving the muted body color everywhere.
const Hi = ({ children, color = "var(--slop-text)" }: { children: ReactNode; color?: string }) => (
  <span style={{ color }}>{children}</span>
);

const AboutPage: NextPage = () => {
  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 sm:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
            {"// about"}
          </div>
          <Link href="/" className="slop-link slop-mono text-[11px] ml-auto">
            ← slop.computer
          </Link>
        </div>
        <h1
          className="m-0 uppercase leading-tight"
          style={{
            color: "var(--slop-text)",
            fontFamily: "var(--slop-font-display)",
            fontSize: "clamp(24px, 5vw, 40px)",
            textShadow: "0 0 14px rgba(255, 62, 201, 0.5)",
          }}
        >
          slop.computer
        </h1>
        <p
          className="slop-mono text-sm sm:text-base leading-relaxed m-0"
          style={{ textTransform: "none", color: "var(--slop-text)" }}
        >
          an onchain podcast for technical humans building with ai — and an experiment in what happens when you weld a{" "}
          <Hi color="var(--slop-cyan)">broadcast studio</Hi>, a <Hi color="var(--slop-purple)">multiplayer room</Hi>,
          and a <Hi color="var(--slop-lime)">shared onchain control surface</Hi> into one little computer.
        </p>
      </header>

      <Section label="// all onchain" title="The chain is the source of truth">
        <P>
          there&apos;s no backend deciding what&apos;s live. the <Hi>SlopComputer</Hi> contract on{" "}
          <Hi color="var(--slop-cyan)">ethereum mainnet</Hi> holds the catalog: episodes are scheduled on-chain, and a
          single <Hi>liveEpisode</Hi> pointer says who&apos;s on air right now.
        </P>
        <P>
          when a show wraps, the recording is pinned to <Hi color="var(--slop-cyan)">ipfs</Hi> — video, chat archive,
          transcript, episode card, and a manifest tying it together — and the manifest CID is written back on-chain via{" "}
          <Hi>setManifest</Hi>. from then on the episode page plays straight from ipfs. anyone can read the entire
          archive directly from the chain; this site is just a viewer pointed at it.
        </P>
      </Section>

      <Section label="// going live" title="How live works">
        <P>
          live is a pipeline. guests join a room on the relay over <Hi>webrtc</Hi> — a slug, an invite link, and a{" "}
          <Hi>sign-in-with-ethereum</Hi> handshake so everyone in the room is a real wallet. the host starts a broadcast
          (a headless browser + ffmpeg, or OBS) that produces an <Hi color="var(--slop-cyan)">HLS</Hi> stream.
        </P>
        <P>
          from there it fans out to <Hi>youtube, twitch, x, and kick</Hi> at the same time. flipping the on-chain{" "}
          <Hi>liveEpisode</Hi> pointer is the moment the homepage stops being a list of past shows and becomes a live
          player — <Hi color="var(--slop-lime)">the chain decides the site is live</Hi>, nothing else does.
        </P>
      </Section>

      <Section label="// three machines, one trench coat" title="Multisig × multiplayer × podcast">
        <P>slop.computer is really three things at once:</P>
        <ul className="flex flex-col gap-3 m-0 pl-0 list-none">
          <li>
            <Hi color="var(--slop-cyan)">◆ a podcast platform</Hi> — schedule, stream, record, and publish episodes that
            live forever onchain instead of inside someone&apos;s CMS.
          </li>
          <li>
            <Hi color="var(--slop-purple)">◆ a multiplayer room</Hi> — multiple humans (and agents) in the same
            wallet-authenticated session, talking, sharing screens, and driving the show together in real time.
          </li>
          <li>
            <Hi color="var(--slop-lime)">◆ a multisig surface</Hi> — because everyone&apos;s already signed in with
            their wallet, the room is a natural place to coordinate and co-sign onchain actions together, instead of
            pasting calldata into a group chat and hoping.
          </li>
        </ul>
        <P>
          the bet: &ldquo;a live room where authenticated people do onchain things together&rdquo; is the same primitive
          whether you&apos;re recording a podcast or running a treasury.
        </P>
      </Section>

      <Section label="// who built this" title="Built by @clawdbotatg">
        <P>
          the whole stack — the contracts, the relay, the broadcast pipeline, and this site — is built by{" "}
          <a href="https://github.com/clawdbotatg" target="_blank" rel="noreferrer" className="slop-link">
            @clawdbotatg
          </a>
          , an ai agent shipping directly to <Hi>main</Hi>.
        </P>
        <P>
          so slop.computer is half a podcast <Hi>about</Hi> building with agents and half a thing an agent{" "}
          <Hi>built</Hi>. the medium is the message.
        </P>
      </Section>

      <Section label="// where this goes" title="Spin up your own slop computer">
        <P>
          today there&apos;s one slop computer. the goal is to make them <Hi color="var(--slop-lime)">spin-uppable</Hi>:
          stand up your own onchain podcast, your own room, your own little computer — in a few clicks.
        </P>
        <P>
          and organizations get something they&apos;re sorely missing — a <Hi>multiplayer multisig</Hi> with a ux that
          doesn&apos;t feel like defusing a bomb, plus a <Hi>meeting room</Hi> bolted right on. govern, talk, and sign
          in the same place. less &ldquo;paste the calldata, everyone please verify&rdquo;, more{" "}
          <Hi color="var(--slop-magenta)">&ldquo;we&apos;re all in the room — let&apos;s do it.&rdquo;</Hi>
        </P>
      </Section>

      <footer
        className="pt-2 flex items-center justify-between gap-3"
        style={{ borderTop: MAGENTA_DASH, paddingTop: 24 }}
      >
        <Link href="/" className="slop-link slop-mono text-[11px]">
          ← back to slop.computer
        </Link>
        <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          <span style={{ color: "var(--slop-accent)" }}>◆</span> onchain · forever
        </span>
      </footer>
    </div>
  );
};

export default AboutPage;
