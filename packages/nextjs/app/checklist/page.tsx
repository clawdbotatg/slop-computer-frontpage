"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";
import { isZeroEpisode } from "~~/types/episode";

// Pre-show / show / post-show punch list. Lives next to /stream and /admin
// as a host-facing utility. Checkboxes persist to localStorage so a reload
// during the show doesn't blow them away; the "clear" button at the bottom
// resets everything for the next episode. A handful of items poll live
// signals (relay auth, HLS, on-chain liveEpisode, recording on disk) and
// render a green/yellow/red badge alongside the manual checkbox — the box
// is still hand-toggled (so the host stays in control), the badge is just
// real-time feedback.
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";
const STORAGE_KEY = "slop:checklist:v1";

type Tone = "green" | "yellow" | "red";

const TONE_COLOR: Record<Tone, string> = {
  green: "var(--slop-lime)",
  yellow: "#ffd24a",
  red: "var(--slop-accent)",
};

type Status = { tone: Tone; text: string };

const ChecklistPage: NextPage = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore checkbox state from localStorage after mount — SSR can't read it
  // and we don't want a hydration mismatch flicker.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore — bad JSON / disabled storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      // ignore
    }
  }, [checked, hydrated]);

  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));
  const clearAll = () => {
    if (!window.confirm("Clear all checkboxes for the next episode?")) return;
    setChecked({});
  };

  const hostStatus = useHostAuthStatus();
  const obsStatus = useObsStreamStatus();
  const live = useLiveEpisodeStatus();
  const recording = useRecordingStatus();

  // Order matters — this is the actual flow the host walks through. Tweak as
  // we learn what's missing or out of order.
  const items: Array<{
    id: string;
    label: string;
    body?: string;
    links?: Array<{ href: string; text: string; external?: boolean }>;
    status?: Status;
  }> = [
    {
      id: "host-signin",
      label: "Sign in as host on the relay",
      body: "SIWE with the owner wallet so the relay sets the slop_session cookie. Required for /admin/recording and /admin/finalize.",
      links: [{ href: RELAY_HTTP_URL, text: RELAY_HTTP_URL, external: true }],
      status: hostStatus,
    },
    {
      id: "obs-publish",
      label: "Start OBS publishing to MediaMTX",
      body: "Fires up the stream so MediaMTX has segments to serve. Until segments arrive, /stream will sit at a black frame.",
      status: obsStatus,
    },
    {
      id: "preview-stream",
      label: "Preview the stream at /stream",
      body: "Sanity-check the feed plays in a browser before you flip the audience-facing page live.",
      links: [{ href: "/stream", text: "/stream" }],
    },
    {
      id: "go-live",
      label: "Click ◉ Go Live in /admin",
      body: "Creates the episode on-chain and points liveEpisode at it. slop.computer flips from the homepage list to the live player.",
      links: [{ href: "/admin", text: "/admin" }],
      status: live.liveOn,
    },
    {
      id: "verify-slug",
      label: "Verify the slug page loads",
      body: live.slug
        ? `slop.computer/${live.slug} should now be live with the HLS player.`
        : "Once live, open slop.computer/<slug> in a fresh tab and confirm the player + chat are wired up.",
      links: live.slug ? [{ href: `/${live.slug}`, text: `/${live.slug}` }] : undefined,
    },
    {
      id: "do-the-show",
      label: "Do the show",
      body: "Talk to the chat, run the demos, keep an eye on /admin for anything weird.",
    },
    {
      id: "end-show",
      label: "End show: hit End show (go offline) in /admin",
      body: "Clears liveEpisode on-chain. Audience page flips back to the homepage list.",
      links: [{ href: "/admin", text: "/admin" }],
      status: live.offlineOn,
    },
    {
      id: "stop-obs",
      label: "Stop OBS publishing",
      body: "Once OBS stops, MediaMTX closes the recording file and it's available for finalize.",
    },
    {
      id: "recording-on-disk",
      label: "Confirm the recording landed on disk",
      body: "Use Check recording in /admin Finalize panel. Polled here too — green = relay sees a file.",
      links: [{ href: "/admin", text: "/admin · Finalize" }],
      status: recording,
    },
    {
      id: "pin-ipfs",
      label: "Pin recording → IPFS",
      body: "Streams the mp4 + chat + transcript + card + manifest to our self-hosted kubo node. Takes a few minutes.",
      links: [{ href: "/admin", text: "/admin · Pin to IPFS" }],
    },
    {
      id: "save-manifest",
      label: "Save manifest CID on-chain",
      body: "Writes ipfs://<manifestCid> to setManifest. The slug page now reads from IPFS instead of HLS.",
      links: [{ href: "/admin", text: "/admin · Save manifest on-chain" }],
    },
    {
      id: "set-contract",
      label: "(Optional) Set the episode contract address",
      body: "If the show shipped a contract / session wallet, point contractAddr at it so the slug page shows the right address.",
      links: [{ href: "/admin", text: "/admin · Save contract on-chain" }],
    },
  ];

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6 sm:py-10 flex flex-col gap-6">
      <header
        className="flex flex-wrap items-center gap-3 pb-4"
        style={{ borderBottom: "1px dashed rgba(255, 62, 201, 0.3)" }}
      >
        <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
          {"// go-live checklist"}
        </div>
        <h1
          className="m-0 uppercase leading-tight"
          style={{
            color: "var(--slop-text)",
            fontFamily: "var(--slop-font-display)",
            fontSize: "clamp(20px, 3.6vw, 30px)",
            textShadow: "0 0 12px rgba(255, 62, 201, 0.45)",
          }}
        >
          Run-of-show
        </h1>
        <div className="ml-auto flex items-center gap-3 slop-mono text-[11px]">
          <Link href="/stream" className="slop-link">
            → /stream
          </Link>
          <Link href="/admin" className="slop-link">
            → /admin
          </Link>
        </div>
      </header>

      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {items.map((item, i) => (
          <ChecklistRow
            key={item.id}
            index={i + 1}
            item={item}
            checked={!!checked[item.id]}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </ol>

      <div className="pt-2 flex items-center justify-between gap-3">
        <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          {Object.values(checked).filter(Boolean).length} / {items.length} done · saved locally
        </span>
        <button
          type="button"
          onClick={clearAll}
          className="slop-mono text-[11px] uppercase tracking-widest px-3 py-2"
          style={{
            background: "transparent",
            color: "var(--slop-accent)",
            border: "1px solid rgba(255, 62, 201, 0.4)",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Clear for next episode
        </button>
      </div>
    </div>
  );
};

const ChecklistRow = ({
  index,
  item,
  checked,
  onToggle,
}: {
  index: number;
  item: {
    id: string;
    label: string;
    body?: string;
    links?: Array<{ href: string; text: string; external?: boolean }>;
    status?: Status;
  };
  checked: boolean;
  onToggle: () => void;
}) => (
  <li
    className="px-4 py-3 flex gap-3"
    style={{
      border: `1px solid ${checked ? "rgba(188, 255, 91, 0.35)" : "rgba(255, 62, 201, 0.25)"}`,
      background: "rgba(10, 15, 36, 0.55)",
      borderRadius: 6,
    }}
  >
    <label className="flex items-start gap-3 cursor-pointer select-none flex-1 min-w-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-[3px]"
        style={{ width: 18, height: 18, accentColor: "var(--slop-lime)", cursor: "pointer" }}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
            {String(index).padStart(2, "0")}
          </span>
          <span
            className="text-sm leading-snug"
            style={{
              color: "var(--slop-text)",
              textDecoration: checked ? "line-through" : undefined,
              opacity: checked ? 0.6 : 1,
            }}
          >
            {item.label}
          </span>
          {item.status ? <StatusBadge status={item.status} /> : null}
        </div>
        {item.body ? (
          <p className="slop-mono text-[11px] m-0" style={{ color: "var(--slop-text-muted)" }}>
            {item.body}
          </p>
        ) : null}
        {item.links?.length ? (
          <div className="flex flex-wrap gap-3 pt-1">
            {item.links.map(l => (
              <a
                key={l.href + l.text}
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                onClick={e => e.stopPropagation()}
                className="slop-link slop-mono text-[11px]"
              >
                {l.text} {l.external ? "↗" : "→"}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  </li>
);

const StatusBadge = ({ status }: { status: Status }) => (
  <span
    className="slop-mono text-[10px] uppercase tracking-widest px-2 py-[2px]"
    style={{
      color: TONE_COLOR[status.tone],
      border: `1px solid ${TONE_COLOR[status.tone]}`,
      borderRadius: 999,
      whiteSpace: "nowrap",
    }}
  >
    ● {status.text}
  </span>
);

// ---- live signal hooks -----------------------------------------------------

const POLL_MS = 5000;

// /auth/me returns the signed-in host (200) or 401 if no cookie. CORS is
// configured on the relay for slop.computer subdomains, so this works from
// the audience-facing page too.
function useHostAuthStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/auth/me`, { credentials: "include" });
        if (cancelled) return;
        if (res.ok) setStatus({ tone: "green", text: "signed in" });
        else setStatus({ tone: "red", text: "not signed in" });
      } catch {
        if (!cancelled) setStatus({ tone: "red", text: "relay unreachable" });
      }
    };
    void check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return status;
}

// The HLS playlist returns 404 until MediaMTX has segments. 200 = OBS is
// pushing. We don't parse the playlist — presence is enough for a status
// dot. The host watches /stream for the actual frame.
function useObsStreamStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(HLS_URL, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) setStatus({ tone: "green", text: "segments live" });
        else setStatus({ tone: "red", text: `no stream (${res.status})` });
      } catch {
        if (!cancelled) setStatus({ tone: "red", text: "fetch failed" });
      }
    };
    void check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return status;
}

// Two badges off one read: one for "live on-chain" (go-live row) and one for
// "offline on-chain" (end-show row). Also surface the slug so we can deep-link
// the verify-slug row.
function useLiveEpisodeStatus(): { liveOn: Status; offlineOn: Status; slug: string | null } {
  const { data: liveEpisode } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "liveEpisode",
    query: { refetchInterval: POLL_MS, refetchOnWindowFocus: false },
  });
  const isLive = !!liveEpisode && !isZeroEpisode(liveEpisode);
  const name = isLive ? liveEpisode!.name || liveEpisode!.slug || "live" : null;
  return {
    liveOn: isLive ? { tone: "green", text: `live: ${truncate(name!, 28)}` } : { tone: "red", text: "not live" },
    offlineOn: isLive ? { tone: "red", text: "still live" } : { tone: "green", text: "off air" },
    slug: isLive ? liveEpisode!.slug : null,
  };
}

// /admin/recording returns { latest: RecordingInfo | null }. 401 if host
// cookie isn't set (handled by the host-signin row already).
function useRecordingStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/admin/recording`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus({ tone: "yellow", text: "needs host signin" });
          return;
        }
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const j = (await res.json()) as { latest: { name: string; sizeBytes: number } | null };
        if (cancelled) return;
        if (j.latest) setStatus({ tone: "green", text: `${formatBytes(j.latest.sizeBytes)} on disk` });
        else setStatus({ tone: "red", text: "no recording" });
      } catch {
        if (!cancelled) setStatus({ tone: "red", text: "fetch failed" });
      }
    };
    void check();
    const id = setInterval(check, POLL_MS * 2);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return status;
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default ChecklistPage;
