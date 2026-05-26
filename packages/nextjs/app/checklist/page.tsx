"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";
import { isZeroEpisode } from "~~/types/episode";

// Pre-show / show / post-show punch list, in the actual order the host walks
// through. Checkboxes persist to localStorage so a reload during the show
// doesn't blow them away; "Clear" resets for the next episode.
//
// The flow lives across two admins:
//   1. live.slop.computer/admin  — relay admin (rooms, broadcast, fanouts, STT)
//   2. slop.computer/admin       — frontpage admin (on-chain liveEpisode, finalize)
//
// Status badges poll the relay (rooms, peers, broadcast, fanouts, recording)
// and the on-chain liveEpisode pointer. Cookies are needed for /admin/* and
// /auth/me — sign in at live.slop.computer/admin first or the host-gated
// badges will sit at "needs host signin".
const HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";
const LIVE_ADMIN_URL = `${RELAY_HTTP_URL}/admin`;
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

  // Restore checkbox state from localStorage after mount — SSR can't read it.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
    } catch {
      /* ignore */
    }
  }, [checked, hydrated]);

  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));
  const clearAll = () => {
    if (!window.confirm("Clear all checkboxes for the next episode?")) return;
    setChecked({});
  };

  const host = useHostAuthStatus();
  const rooms = useRoomsStatus();
  const peers = usePeersStatus();
  const broadcast = useBroadcastStatus();
  const hls = useHlsStatus();
  const fanouts = useFanoutsStatus();
  const live = useLiveEpisodeStatus();
  const recording = useRecordingStatus();

  const items: Array<{
    id: string;
    label: string;
    body?: string;
    links?: Array<{ href: string; text: string; external?: boolean }>;
    status?: Status;
  }> = [
    {
      id: "live-admin-signin",
      label: "Sign in to live.slop.computer/admin",
      body: "SIWE with the host wallet on the relay admin. Sets the slop_session cookie that every /admin/* endpoint below (rooms, broadcast, fanouts, recording, finalize) reads.",
      links: [{ href: LIVE_ADMIN_URL, text: LIVE_ADMIN_URL, external: true }],
      status: host,
    },
    {
      id: "create-room",
      label: "Create the room (slug + auto-password)",
      body: "Live admin → Create a room. Type the slug, hit Create — the relay hashes the password and writes auth.json to disk.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Create a room", external: true }],
      status: rooms,
    },
    {
      id: "copy-share-link",
      label: "Copy the invite link and send it to your guest",
      body: "The Rooms list has a Copy button per row → puts https://live.slop.computer/<slug>?invite=<password> on the clipboard. Send it via Signal/DM/whatever.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Rooms", external: true }],
    },
    {
      id: "guest-joined",
      label: "Confirm the guest joined the room",
      body: "Live admin → Connected guests shows every peer on the relay (refreshes every 3s). Wait until you see them before going live.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Connected guests", external: true }],
      status: peers,
    },
    {
      id: "start-broadcast",
      label: "Start the broadcast (server-side OR OBS)",
      body: "Either: live admin → Server-side broadcast → Start (headless chromium + ffmpeg next to mediamtx), OR: live admin → Set up OBS → paste RTMP URL+key into OBS → Start Streaming. Either path produces HLS segments at media.slop.computer.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Broadcast", external: true }],
      status: broadcast.tone === "green" ? broadcast : hls,
    },
    {
      id: "preview-stream",
      label: "Preview the stream at /stream",
      body: "Sanity-check the feed actually plays in a browser before flipping the audience-facing page live.",
      links: [{ href: "/stream", text: "/stream" }],
    },
    {
      id: "start-fanouts",
      label: "(Optional) Start restream destinations",
      body: "Live admin → Restream destinations. Toggle YouTube/Twitch/Twitter/Kick on individually; each runs an ffmpeg -c copy on the relay box.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Restream destinations", external: true }],
      status: fanouts,
    },
    {
      id: "schedule-on-chain",
      label: "Open the frontpage scheduler (or click [schedule] from live admin)",
      body: "Use the [schedule] link next to the room in live admin — it deep-links into slop.computer/admin?liveSlugToSchedule=<slug> with name+slug+datetime pre-filled.",
      links: [{ href: "/admin", text: "slop.computer/admin" }],
    },
    {
      id: "go-live-on-chain",
      label: "Click ◉ Go Live on slop.computer/admin",
      body: "Either ◉ Go Live (one-shot create+live) or schedule then setLive on the row. Either way the homepage flips from list view to the live HLS player.",
      links: [{ href: "/admin", text: "slop.computer/admin", external: false }],
      status: live.liveOn,
    },
    {
      id: "verify-slug",
      label: "Verify the slug page loads",
      body: live.slug
        ? `slop.computer/${live.slug} should be showing the HLS player + chat.`
        : "Once live, open slop.computer/<slug> in a fresh tab and confirm player + chat.",
      links: live.slug ? [{ href: `/${live.slug}`, text: `/${live.slug}` }] : undefined,
    },
    {
      id: "do-show",
      label: "Do the show",
      body: "Talk to chat, run demos. Keep live admin open for kicks/STT toggles, slop.computer/admin for nothing (you're live now).",
    },
    {
      id: "end-show",
      label: "End show: hit End show (go offline) on slop.computer/admin",
      body: "Clears the on-chain liveEpisode pointer. Homepage flips back to list view immediately.",
      links: [{ href: "/admin", text: "slop.computer/admin" }],
      status: live.offlineOn,
    },
    {
      id: "stop-broadcast",
      label: "Stop the broadcast",
      body: "Server-side: live admin → Stop. OBS: Stop Streaming. MediaMTX closes the recording file once the publisher disconnects.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Broadcast", external: true }],
    },
    {
      id: "stop-fanouts",
      label: "(If used) Stop restream destinations",
      body: "Toggle each ON destination back to OFF so we're not pushing dead air to YT/Twitch etc.",
      links: [{ href: LIVE_ADMIN_URL, text: "live admin · Restream destinations", external: true }],
    },
    {
      id: "recording-on-disk",
      label: "Confirm the recording landed on disk",
      body: "slop.computer/admin → Finalize panel → Check recording. Polled here too — green = relay sees a fresh file.",
      links: [{ href: "/admin", text: "slop.computer/admin · Finalize" }],
      status: recording,
    },
    {
      id: "pin-ipfs",
      label: "Pin recording → IPFS",
      body: "Streams the mp4 + chat archive + transcript + card + manifest to our self-hosted kubo node. Takes a few minutes; progress bar shows phases.",
      links: [{ href: "/admin", text: "slop.computer/admin · Pin to IPFS" }],
    },
    {
      id: "save-manifest",
      label: "Save manifest CID on-chain",
      body: "Writes ipfs://<manifestCid> via setManifest(id, …). The slug page now reads the recording from IPFS instead of HLS.",
      links: [{ href: "/admin", text: "slop.computer/admin · Save manifest on-chain" }],
    },
    {
      id: "set-contract",
      label: "(Optional) Set the episode contract address",
      body: "If the show shipped a contract or session wallet, point contractAddr at it so the slug page can show the right address.",
      links: [{ href: "/admin", text: "slop.computer/admin · Save contract on-chain" }],
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
          <a href={LIVE_ADMIN_URL} target="_blank" rel="noreferrer" className="slop-link">
            → live admin ↗
          </a>
          <Link href="/admin" className="slop-link">
            → /admin
          </Link>
          <Link href="/stream" className="slop-link">
            → /stream
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

type AuthMe = { authenticated: boolean; role?: string; address?: string | null };

// /auth/me returns 200 with { authenticated: false } when not signed in, or
// { authenticated: true, role: "host" | "guest" | … }. We need role === "host"
// for any of the /admin/* endpoints to work, so the badge only goes green for
// that exact case.
function useHostAuthStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/auth/me`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const data = (await res.json()) as AuthMe;
        if (cancelled) return;
        if (data.authenticated && data.role === "host") setStatus({ tone: "green", text: "signed in as host" });
        else if (data.authenticated) setStatus({ tone: "red", text: `signed in as ${data.role ?? "?"}` });
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

type AdminRoom = { slug: string; createdAt: number | null; paidUntil: number | null; hot: boolean; sttOn: boolean };

// /admin/rooms returns { rooms: AdminRoom[] }. 401 if not host. Surfaces the
// total count + how many are currently "hot" (peers connected).
function useRoomsStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/admin/rooms`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus({ tone: "yellow", text: "needs host signin" });
          return;
        }
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const j = (await res.json()) as { rooms?: AdminRoom[] };
        if (cancelled) return;
        const rooms = j.rooms ?? [];
        if (rooms.length === 0) {
          setStatus({ tone: "red", text: "no rooms yet" });
          return;
        }
        const hot = rooms.filter(r => r.hot).length;
        setStatus({ tone: "green", text: `${rooms.length} room${rooms.length === 1 ? "" : "s"} · ${hot} hot` });
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

type Peer = { id: string; role: string; address: string | null };

// /admin/peers returns { peers: Peer[] }. Green if at least one non-host peer
// is connected; yellow if only the host is on the relay; red if empty.
function usePeersStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/admin/peers`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus({ tone: "yellow", text: "needs host signin" });
          return;
        }
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const j = (await res.json()) as { peers?: Peer[] };
        if (cancelled) return;
        const peers = j.peers ?? [];
        const guests = peers.filter(p => p.role !== "host").length;
        if (guests > 0) {
          setStatus({ tone: "green", text: `${guests} guest${guests === 1 ? "" : "s"} · ${peers.length} peers` });
        } else if (peers.length > 0) {
          setStatus({ tone: "yellow", text: `host only (${peers.length})` });
        } else {
          setStatus({ tone: "red", text: "no peers" });
        }
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

type BroadcastApi = { active: string; enabled: string; activeForSeconds: number | null };

// /admin/broadcast/status reflects the slop-broadcast systemd unit on the
// relay box. active === "active" means the server-side broadcaster is up; we
// fall back to HLS-detection if the host's running OBS instead.
function useBroadcastStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/admin/broadcast/status`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus({ tone: "yellow", text: "needs host signin" });
          return;
        }
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const j = (await res.json()) as BroadcastApi;
        if (cancelled) return;
        if (j.active === "active") {
          const uptime = formatUptime(j.activeForSeconds);
          setStatus({ tone: "green", text: `broadcasting · ${uptime}` });
        } else if (j.active === "activating") {
          setStatus({ tone: "yellow", text: "activating…" });
        } else {
          setStatus({ tone: "red", text: `server-side: ${j.active}` });
        }
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

// MediaMTX HLS playlist as a fallback signal — green when *either* server-
// side or OBS is producing segments. The broadcast row prefers /admin/broadcast
// but rolls over to this when server-side is "inactive" but HLS is alive.
function useHlsStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(HLS_URL, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) setStatus({ tone: "green", text: "HLS live (OBS?)" });
        else setStatus({ tone: "red", text: `no HLS (${res.status})` });
      } catch {
        if (!cancelled) setStatus({ tone: "red", text: "HLS fetch failed" });
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

type Fanout = { id: string; name: string; configured: boolean; running: boolean };

// /admin/fanouts returns the restream destination list. Green when any
// destination is running; yellow when configured but idle; red if relay
// returned nothing.
function useFanoutsStatus(): Status {
  const [status, setStatus] = useState<Status>({ tone: "yellow", text: "checking…" });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/admin/fanouts`, { credentials: "include" });
        if (cancelled) return;
        if (res.status === 401) {
          setStatus({ tone: "yellow", text: "needs host signin" });
          return;
        }
        if (!res.ok) {
          setStatus({ tone: "red", text: `relay ${res.status}` });
          return;
        }
        const j = (await res.json()) as { fanouts?: Fanout[] };
        if (cancelled) return;
        const fanouts = j.fanouts ?? [];
        const running = fanouts.filter(f => f.running);
        if (running.length > 0) {
          setStatus({ tone: "green", text: `${running.map(f => f.name).join(" + ")} live` });
        } else if (fanouts.some(f => f.configured)) {
          setStatus({ tone: "yellow", text: "configured · none running" });
        } else {
          setStatus({ tone: "red", text: "none configured" });
        }
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

// Two badges off the one on-chain liveEpisode read: "live: <name>" for the
// go-live row, and inverted "still live / off air" for the end-show row.
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

// /admin/recording returns { latest: RecordingInfo | null }.
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

function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default ChecklistPage;
