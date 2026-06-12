"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { type EpisodeManifest, SLOP_CHAIN_ID, gatewayUrl } from "~~/types/episode";

// ADMIN-ONLY clips review, rendered at the bottom of an episode page. The clips
// themselves live in public bgipfs and are referenced by the manifest, so this
// gate is pure curation — we just don't surface the clip grid to normal viewers.
// "Admin" = the connected wallet is the SlopComputer contract owner (austin) or
// in NEXT_PUBLIC_ADMIN_ADDRESSES (e.g. clawdbotatg.eth), mirroring the relay's
// ADMIN_ADDRESSES model. Renders nothing for everyone else.

const ADMIN_ADDRESSES = (process.env.NEXT_PUBLIC_ADMIN_ADDRESSES || "")
  .toLowerCase()
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

type ClipEntry = {
  rank: number;
  title: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  speakers: string[];
  mobile: { cid: string; w: number; h: number; format: string; sizeBytes: number };
  poster?: { cid: string; format: string };
  altMobile?: { cid: string; w: number; h: number; format: string; sizeBytes: number; poster?: { cid: string; format: string } };
  landscape?: { cid: string; format: string; sizeBytes: number; poster?: { cid: string; format: string } };
  captions?: { cid: string; format: string };
  tweetShort?: string;
  tweetLong?: string;
};
type ClipsBundle = { v: number; slug: string; generatedAt: string; clips: ClipEntry[] };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="slop-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border"
      style={{ borderColor: "var(--slop-magenta-dim)", color: copied ? "var(--slop-lime)" : "var(--slop-text-muted)" }}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}

function TweetBlock({ kind, text }: { kind: "short" | "long"; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="slop-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--slop-text-muted)" }}>
          {kind}
        </span>
        <CopyButton text={text} label="copy" />
      </div>
      <p className="text-[12px] leading-snug m-0" style={{ color: "var(--slop-text)" }}>
        {text}
      </p>
    </div>
  );
}

type FmtKey = "mobile" | "altMobile" | "landscape";

// "Tweeted" bookkeeping — a purely-local checklist so the admin remembers which
// clips already went out. One localStorage map keyed by slug|title: titles come
// from the cached candidates pass, so the mark survives re-renders/re-ranks of
// an episode (rank and CID both change on a re-publish; the title doesn't).
const TWEETED_KEY = "slop-tweeted-clips";
function readTweeted(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(TWEETED_KEY) || "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

function ClipCard({ c, slug }: { c: ClipEntry; slug: string }) {
  const name = (s: string) => `${slug}-${c.rank}-${s}.mp4`;
  // Available formats in display order: default 9:16, ALT 9:16 (geometry/alt
  // take, when published), 16:9 landscape. Each carries its own poster + aspect.
  const formats: { key: FmtKey; label: string; cid: string; poster?: string; ar: string; dl: string }[] = [
    { key: "mobile", label: "9:16", cid: c.mobile.cid, poster: c.poster?.cid, ar: "9 / 16", dl: "9x16" },
    ...(c.altMobile?.cid
      ? [{ key: "altMobile" as const, label: "ALT 9:16", cid: c.altMobile.cid, poster: c.altMobile.poster?.cid, ar: "9 / 16", dl: "9x16-alt" }]
      : []),
    ...(c.landscape?.cid
      ? [{ key: "landscape" as const, label: "16:9", cid: c.landscape.cid, poster: c.landscape.poster?.cid, ar: "16 / 9", dl: "16x9" }]
      : []),
  ];
  const [fmt, setFmt] = useState<FmtKey>("mobile");
  const cur = formats.find(f => f.key === fmt) ?? formats[0]!;

  // Read after mount (localStorage doesn't exist during SSR/hydration).
  const markKey = `${slug}|${c.title}`;
  const [tweeted, setTweeted] = useState(false);
  useEffect(() => {
    setTweeted(!!readTweeted()[markKey]);
  }, [markKey]);
  const toggleTweeted = () => {
    const map = readTweeted();
    if (map[markKey]) delete map[markKey];
    else map[markKey] = true;
    try {
      localStorage.setItem(TWEETED_KEY, JSON.stringify(map));
    } catch {
      /* storage full/blocked — the checkbox still toggles for this page view */
    }
    setTweeted(!!map[markKey]);
  };

  return (
    <article
      className="flex flex-col gap-2 rounded-lg overflow-hidden p-2"
      style={{
        background: "var(--slop-panel, #0a0f24)",
        border: "1px solid var(--slop-magenta-dim)",
        opacity: tweeted ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <video
        key={cur.cid}
        controls
        preload="none"
        poster={cur.poster ? gatewayUrl(cur.poster) : undefined}
        src={gatewayUrl(cur.cid, name(cur.dl))}
        className="w-full rounded"
        style={{ aspectRatio: cur.ar, background: "#000", objectFit: "contain" }}
      />
      {formats.length > 1 ? (
        <div className="flex gap-1">
          {formats.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFmt(f.key)}
              className="slop-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border"
              style={{
                borderColor: "var(--slop-magenta-dim)",
                color: fmt === f.key ? "var(--slop-lime)" : "var(--slop-text-muted)",
                background: fmt === f.key ? "rgba(188,255,91,0.08)" : "transparent",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold leading-tight" style={{ color: "var(--slop-text)" }}>
          {`#${c.rank} ${c.title}`}
        </span>
        <span className="slop-mono text-[10px] whitespace-nowrap" style={{ color: "var(--slop-text-muted)" }}>
          {`${Math.round(c.durationSec)}s`}
        </span>
      </div>
      {c.speakers?.length ? (
        <span className="slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
          {c.speakers.join(" · ")}
        </span>
      ) : null}
      {c.tweetShort ? <TweetBlock kind="short" text={c.tweetShort} /> : null}
      {c.tweetLong ? <TweetBlock kind="long" text={c.tweetLong} /> : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {formats.map(f => (
          <a key={f.key} href={gatewayUrl(f.cid, name(f.dl), true)} className="slop-link slop-mono text-[10px]">
            {`${f.label} mp4 ⬇`}
          </a>
        ))}
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none mt-0.5">
        <input type="checkbox" checked={tweeted} onChange={toggleTweeted} className="cursor-pointer" style={{ accentColor: "var(--slop-lime)" }} />
        <span
          className="slop-mono text-[10px] uppercase tracking-wide"
          style={{ color: tweeted ? "var(--slop-lime)" : "var(--slop-text-muted)" }}
        >
          tweeted
        </span>
      </label>
    </article>
  );
}

export function ClipsSection({ manifest, slug }: { manifest: EpisodeManifest | null; slug: string }) {
  const { address } = useAccount();
  const me = address?.toLowerCase();
  // Only read owner() once a wallet is connected — public visitors never trigger it.
  const { data: owner } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "owner",
    chainId: SLOP_CHAIN_ID,
    query: { enabled: !!me },
  });
  const isAdmin = !!me && (me === owner?.toLowerCase() || ADMIN_ADDRESSES.includes(me));

  const cid = manifest?.clips?.cid;
  const [bundle, setBundle] = useState<ClipsBundle | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!isAdmin || !cid) return;
    let cancelled = false;
    setErr(false);
    fetch(gatewayUrl(cid))
      .then(r => (r.ok ? (r.json() as Promise<ClipsBundle>) : Promise.reject()))
      .then(b => !cancelled && setBundle(b))
      .catch(() => !cancelled && setErr(true));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, cid]);

  if (!isAdmin || !cid) return null;

  const clips = (bundle?.clips ?? []).slice().sort((a, b) => a.rank - b.rank);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-base uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
          Clips
        </h2>
        <span
          className="slop-mono text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded"
          style={{ color: "var(--slop-magenta)", border: "1px solid var(--slop-magenta-dim)" }}
        >
          admin only
        </span>
        {manifest?.clips?.count ? (
          <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
            {`// ${manifest.clips.count} clips`}
          </span>
        ) : null}
      </div>

      {err ? (
        <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          couldn’t load the clips bundle from IPFS.
        </p>
      ) : !bundle ? (
        <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          loading clips…
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clips.map(c => (
            <ClipCard key={c.rank} c={c} slug={slug} />
          ))}
        </div>
      )}
    </section>
  );
}
