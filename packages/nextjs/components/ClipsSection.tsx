"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { LoadingBar } from "~~/components/ui/LoadingBar";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";
import { useSiweAuth } from "~~/hooks/useSiweAuth";
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
  altMobile?: {
    cid: string;
    w: number;
    h: number;
    format: string;
    sizeBytes: number;
    poster?: { cid: string; format: string };
  };
  landscape?: { cid: string; format: string; sizeBytes: number; poster?: { cid: string; format: string } };
  captions?: { cid: string; format: string };
  tweetShort?: string;
  tweetMedium?: string;
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

function TweetBlock({ kind, text }: { kind: "short" | "medium" | "long"; text: string }) {
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
      ? [
          {
            key: "altMobile" as const,
            label: "ALT 9:16",
            cid: c.altMobile.cid,
            poster: c.altMobile.poster?.cid,
            ar: "9 / 16",
            dl: "9x16-alt",
          },
        ]
      : []),
    ...(c.landscape?.cid
      ? [
          {
            key: "landscape" as const,
            label: "16:9",
            cid: c.landscape.cid,
            poster: c.landscape.poster?.cid,
            ar: "16 / 9",
            dl: "16x9",
          },
        ]
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
      {c.tweetMedium ? <TweetBlock kind="medium" text={c.tweetMedium} /> : null}
      {c.tweetLong ? <TweetBlock kind="long" text={c.tweetLong} /> : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {formats.map(f => (
          <a key={f.key} href={gatewayUrl(f.cid, name(f.dl), true)} className="slop-link slop-mono text-[10px]">
            {`${f.label} mp4 ⬇`}
          </a>
        ))}
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none mt-0.5">
        <input
          type="checkbox"
          checked={tweeted}
          onChange={toggleTweeted}
          className="cursor-pointer"
          style={{ accentColor: "var(--slop-lime)" }}
        />
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

// Parse a "M:SS" / "H:MM:SS" / bare-seconds string into seconds (null if bad).
// Mirrors the clipper's parseClockTime so what you type here matches the CLI.
function parseClock(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

type DoneEvent = {
  phase: "done";
  title?: string;
  duration?: number;
  speaker?: string;
  name?: string;
  mobile?: string; // relay-relative /admin/clip-file path
  altMobile?: string;
  landscape?: string;
};

// ADMIN: render ONE custom clip from an explicit window. POSTs to the relay's
// /admin/clip-at (which spawns the clipper with --clip-at), streams progress,
// then previews + lets you download the rendered 9:16 mp4. Nothing is published
// or written to the manifest — purely a render-and-download tool.
function CustomClipForm({ slug }: { slug: string }) {
  const { signIn } = useSiweAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  // Time-based progress: there's no true % to report (the long ffmpeg caption
  // burn emits no sub-progress), so we ESTIMATE total runtime from the clip
  // length and fill a bar against elapsed wall-clock — i.e. "a guess at how long
  // it'll take". `now` ticks every second while busy; `est` is set per render;
  // `step` is the current activity line; `completed` snaps the bar to 100%.
  const [startMs, setStartMs] = useState(0);
  const [now, setNow] = useState(0);
  const [est, setEst] = useState(90);
  const [completed, setCompleted] = useState(false);
  const [step, setStep] = useState("");
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<DoneEvent | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Track blob URLs we mint so we can revoke them (avoid leaks across renders).
  const blobUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      blobUrls.current.forEach(u => URL.revokeObjectURL(u));
    },
    [],
  );

  const fetchClipBlob = async (path: string): Promise<string> => {
    const r = await fetch(`${RELAY_HTTP_URL}${path}`, { credentials: "include" });
    if (!r.ok) throw new Error(`couldn't fetch clip file (${r.status})`);
    const url = URL.createObjectURL(await r.blob());
    blobUrls.current.push(url);
    return url;
  };

  const download = async (path: string, dl: string) => {
    try {
      const url = await fetchClipBlob(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-custom-${dl}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  // Read the relay's NDJSON progress stream, dispatching each event.
  const consumeStream = async (res: Response) => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no response stream");
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.phase === "log" && typeof ev.line === "string") {
          // Surface the current activity (cleaned clipper line) under the bar.
          const clean = ev.line
            .replace(/^[▸✓\s]+/, "")
            .replace(/…\s*$/, "")
            .trim();
          if (clean) setStep(clean.slice(0, 80));
        } else if (ev.phase === "error") {
          throw new Error(String(ev.message ?? "render failed"));
        } else if (ev.phase === "done") {
          const d = ev as DoneEvent;
          setCompleted(true);
          setStep("done");
          setResult(d);
          if (d.mobile) setVideoUrl(await fetchClipBlob(d.mobile));
        }
      }
    }
  };

  const run = async () => {
    setErr("");
    setResult(null);
    if (videoUrl) {
      // Drop the previous preview's blob.
      setVideoUrl(null);
    }
    const s = parseClock(start);
    const e = parseClock(end);
    if (s == null || e == null) {
      setErr("enter times as M:SS (e.g. 7:18) or seconds");
      return;
    }
    if (e <= s) {
      setErr("end must be after start");
      return;
    }
    if (e - s > 600) {
      setErr("window too long (max 10 min)");
      return;
    }
    setBusy(true);
    setCompleted(false);
    setStep("starting…");
    // Estimate total runtime: fixed pipeline overhead (cache hits + re-transcribe
    // + window detection) plus ~2× the clip length for the caption burn. Tuned
    // against real runs (~42s clip ≈ ~115s). A slight over-estimate so the bar
    // lands near 100% right as the render finishes rather than pinning early.
    setEst(Math.max(50, Math.round(45 + 2.0 * (e - s))));
    setStartMs(Date.now());
    setNow(Date.now());
    try {
      const url = `${RELAY_HTTP_URL}/admin/clip-at?slug=${encodeURIComponent(slug)}`;
      const body = JSON.stringify({ start: s, end: e, title: title.trim() || undefined });
      const opts: RequestInit = {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body,
      };
      let res = await fetch(url, opts);
      if (res.status === 401) {
        // No relay session yet — sign in with the wallet (SIWE), then retry once.
        const ok = await signIn(setErr);
        if (!ok) {
          setBusy(false);
          return;
        }
        res = await fetch(url, opts);
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `request failed (${res.status})`);
      }
      await consumeStream(res);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Fill the bar against elapsed/est, capped at 97% until the render reports done
  // (so it never sits at a fake 100%). The 1s ticker keeps the bar + countdown
  // moving through the silent caption-burn.
  const elapsed = busy && startMs ? Math.max(0, (now - startMs) / 1000) : 0;
  const fmtDur = (n: number) =>
    n >= 60 ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}` : `${Math.ceil(n)}s`;
  const barPct = completed ? 100 : Math.min(97, Math.round((elapsed / Math.max(1, est)) * 100));
  const etaNote = completed
    ? "done"
    : elapsed < est
      ? `~${fmtDur(est - elapsed)} left · ${fmtDur(elapsed)} elapsed (est.)`
      : `wrapping up… · ${fmtDur(elapsed)} elapsed`;

  const field = (label: string, value: string, set: (v: string) => void, placeholder: string, mono = true) => (
    <label className="flex flex-col gap-1">
      <span className="slop-mono text-[10px] uppercase tracking-wide" style={{ color: "var(--slop-text-muted)" }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={ev => set(ev.target.value)}
        placeholder={placeholder}
        disabled={busy}
        className={`px-2 py-1 rounded border bg-transparent text-[13px] ${mono ? "slop-mono" : ""}`}
        style={{ borderColor: "var(--slop-magenta-dim)", color: "var(--slop-text)" }}
      />
    </label>
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-lg p-3 mt-2"
      style={{ background: "var(--slop-panel, #0a0f24)", border: "1px dashed var(--slop-magenta-dim)" }}
    >
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] uppercase tracking-wide m-0" style={{ color: "var(--slop-text)" }}>
          Make a custom clip
        </h3>
        <span className="slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
          {"// render only — not published"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_2fr] gap-2">
        {field("start", start, setStart, "7:18")}
        {field("end", end, setEnd, "8:05")}
        {field("title (optional)", title, setTitle, "The Hermès mixup", false)}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="slop-mono text-[11px] uppercase tracking-wide px-3 py-1 rounded border"
          style={{
            borderColor: "var(--slop-lime)",
            color: busy ? "var(--slop-text-muted)" : "var(--slop-lime)",
            background: busy ? "transparent" : "rgba(188,255,91,0.08)",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "rendering…" : "render clip"}
        </button>
      </div>
      {busy ? (
        <div
          className="flex w-full flex-col gap-2 px-3 py-3"
          style={{ border: "1px dashed rgba(255, 62, 201, 0.35)", background: "rgba(0,0,0,0.25)" }}
        >
          <LoadingBar cells={28} progress={barPct} caption={<span className="slop-mono text-[11px]">{barPct}%</span>} />
          <span className="slop-mono text-[11px]" style={{ color: "var(--slop-magenta, #ff3ec9)" }}>
            {etaNote}
          </span>
          {step ? (
            <span className="slop-mono text-[10px] break-all" style={{ color: "var(--slop-text-muted)" }}>
              {step}
            </span>
          ) : null}
        </div>
      ) : null}
      {err ? (
        <p className="slop-mono text-[11px] m-0" style={{ color: "var(--slop-magenta)" }}>
          {err}
        </p>
      ) : null}
      {result && videoUrl ? (
        <div className="flex flex-col gap-2">
          <video
            controls
            autoPlay
            src={videoUrl}
            className="w-full rounded"
            style={{ aspectRatio: "9 / 16", maxHeight: 520, background: "#000", objectFit: "contain" }}
          />
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold" style={{ color: "var(--slop-text)" }}>
              {result.title ?? "custom clip"}
            </span>
            {result.duration ? (
              <span className="slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
                {`${Math.round(result.duration)}s`}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {result.mobile ? (
              <button
                type="button"
                onClick={() => download(result.mobile!, "9x16")}
                className="slop-link slop-mono text-[10px]"
              >
                9:16 mp4 ⬇
              </button>
            ) : null}
            {result.altMobile ? (
              <button
                type="button"
                onClick={() => download(result.altMobile!, "9x16-alt")}
                className="slop-link slop-mono text-[10px]"
              >
                ALT 9:16 mp4 ⬇
              </button>
            ) : null}
            {result.landscape ? (
              <button
                type="button"
                onClick={() => download(result.landscape!, "16x9")}
                className="slop-link slop-mono text-[10px]"
              >
                16:9 mp4 ⬇
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
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

  // Admins always get this section (for the custom-clip tool); the auto-clip
  // grid only appears when the episode has a published clips bundle.
  if (!isAdmin) return null;

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

      {!cid ? (
        <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          no clips published for this episode yet — but you can still cut a custom one below.
        </p>
      ) : err ? (
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

      <CustomClipForm slug={slug} />
    </section>
  );
}
