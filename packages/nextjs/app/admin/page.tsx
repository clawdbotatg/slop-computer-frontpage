"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AddressInput } from "@scaffold-ui/components";
import { CID } from "multiformats/cid";
import type { NextPage } from "next";
import {
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  parseUnits,
} from "viem";
import { namehash, normalize } from "viem/ens";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  Button,
  ClipProgress,
  LoadingBar,
  advanceClipProgress,
  finishClipProgress,
  initialClipProgress,
} from "~~/components/ui";
import externalContracts from "~~/contracts/externalContracts";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";
import {
  type Episode,
  SLOP_CHAIN_ID,
  ZERO_ADDRESS,
  formatDate,
  isZeroEpisode,
  relaySlug,
  slugify,
} from "~~/types/episode";

const CONTRACT_ADDRESS = externalContracts[1].SlopComputer.address;
const READ_QUERY = { refetchInterval: 5000, refetchOnWindowFocus: false } as const;

/**
 * Owner-only console for the slop.computer registry. Wraps the on-chain
 * writes (goLive, addEpisode, setEpisodeUrl, setLive, goOffline,
 * deleteEpisode, setEpisodeContract) in actual forms so we don't have to
 * fight the SE-2 /debug ABI dump every time we want to start a show.
 *
 * Gates in order: connect wallet → mainnet → contract owner → console.
 */
const AdminPage: NextPage = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { data: owner } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "owner",
    chainId: SLOP_CHAIN_ID,
  });

  const ownerLower = owner?.toLowerCase();
  const isOwner = !!ownerLower && !!address && address.toLowerCase() === ownerLower;

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:py-12 flex flex-col gap-8">
      <AdminHeader />

      {!isConnected ? (
        <Gate
          title="connect wallet"
          body="this page is for the registry owner — sign in with the wallet that owns the slop.computer contract."
        >
          <ConnectButton />
        </Gate>
      ) : chainId !== 1 ? (
        <Gate
          title="wrong network"
          body="the slop.computer contract lives on ethereum mainnet. switch your wallet to mainnet to continue."
        >
          <Button onClick={() => switchChain({ chainId: 1 })} variant="primary">
            Switch to mainnet
          </Button>
        </Gate>
      ) : !isOwner ? (
        <Gate title="not the owner" body={`connected as ${address}. the contract owner is ${owner ?? "loading…"}.`}>
          <ConnectButton />
        </Gate>
      ) : (
        <OwnerConsole />
      )}
    </div>
  );
};

const AdminHeader = () => (
  <header className="flex flex-col gap-2 pb-4" style={{ borderBottom: "1px dashed rgba(255, 62, 201, 0.3)" }}>
    <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
      {"// admin · registry console"}
    </div>
    <h1
      className="m-0 uppercase leading-tight"
      style={{
        color: "var(--slop-text)",
        fontFamily: "var(--slop-font-display)",
        fontSize: "clamp(24px, 4vw, 40px)",
        textShadow: "0 0 12px rgba(255, 62, 201, 0.45)",
      }}
    >
      slop.computer · owner controls
    </h1>
    <div
      className="slop-mono text-[11px] flex flex-wrap items-center gap-3"
      style={{ color: "var(--slop-text-muted)" }}
    >
      <span>contract: {CONTRACT_ADDRESS} · ethereum mainnet</span>
      <span>·</span>
      <a href="/stream" target="_blank" rel="noreferrer" className="slop-link">
        preview stream ↗
      </a>
    </div>
  </header>
);

const Gate = ({ title, body, children }: { title: string; body: string; children: React.ReactNode }) => (
  <section
    className="px-6 py-10 sm:py-14 flex flex-col items-center text-center gap-4"
    style={{
      border: "1px solid rgba(255, 62, 201, 0.4)",
      background: "rgba(10, 15, 36, 0.55)",
      borderRadius: 8,
    }}
  >
    <div className="slop-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--slop-magenta)" }}>
      {"// gate"}
    </div>
    <h2
      className="m-0 uppercase"
      style={{
        color: "var(--slop-text)",
        fontFamily: "var(--slop-font-display)",
        fontSize: "clamp(20px, 3.2vw, 28px)",
      }}
    >
      {title}
    </h2>
    <p className="max-w-lg slop-mono text-sm break-words" style={{ color: "var(--slop-text-muted)" }}>
      {body}
    </p>
    <div className="pt-2">{children}</div>
  </section>
);

const OwnerConsole = () => {
  const { data: liveEpisode, refetch: refetchLive } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "liveEpisode",
    chainId: SLOP_CHAIN_ID,
    query: READ_QUERY,
  });
  const { data: episodes, refetch: refetchEpisodes } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "getEpisodes",
    args: [0n, 100n],
    chainId: SLOP_CHAIN_ID,
    query: READ_QUERY,
  });
  const { data: episodeCount } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "episodeCount",
    chainId: SLOP_CHAIN_ID,
    query: READ_QUERY,
  });

  const refreshAll = () => {
    void refetchLive();
    void refetchEpisodes();
  };

  const liveId = liveEpisode && !isZeroEpisode(liveEpisode) ? liveEpisode.id : null;

  // Deep-link from live.slop.computer/admin/<room>:
  //   /admin?liveSlugToSchedule=<slug>
  // pre-fills name + slug to the live room's slug and datetime to now+1h.
  // After contract redeploy with Episode.liveSlug, this URL param can map
  // to a dedicated liveSlug field while name/slug stay user-editable.
  const searchParams = useSearchParams();
  const liveSlugToSchedule = searchParams.get("liveSlugToSchedule") ?? "";
  const prefill = useMemo(
    () =>
      liveSlugToSchedule
        ? {
            slug: liveSlugToSchedule,
            datetime: toLocalDatetimeValue(new Date(Date.now() + 60 * 60 * 1000)),
          }
        : null,
    [liveSlugToSchedule],
  );

  // Scroll the schedule form into view when the page is opened with a prefill —
  // saves the host from hunting for it.
  const scheduleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefill) {
      scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Re-fire on liveEpisode/episodes so the scroll lands correctly after the
    // panels above the form (LiveStatusPanel, FinalizePanel) expand once the
    // async contract reads resolve and push the form further down.
  }, [prefill, liveEpisode, episodes]);

  return (
    <div className="flex flex-col gap-10">
      <LiveStatusPanel liveEpisode={liveEpisode} onChange={refreshAll} />
      {episodes && episodes.length > 0 ? (
        <FinalizePanel episodes={episodes} liveEpisode={liveEpisode} onUrlUpdated={refreshAll} />
      ) : null}
      <div ref={scheduleRef}>
        <AddFutureEpisodeForm onDone={refreshAll} prefill={prefill} />
      </div>
      <GoLiveForm onDone={refreshAll} />
      <EpisodeTable
        episodes={episodes}
        liveId={liveId}
        totalCount={episodeCount !== undefined ? Number(episodeCount) : undefined}
        onChange={refreshAll}
      />
      <AddEpisodeForm onDone={refreshAll} />
      <SetNamePanel />
      <SetContenthashPanel />
      <RecoverAssetsPanel />
    </div>
  );
};

const Section = ({
  label,
  title,
  children,
  tone,
}: {
  label: string;
  title: string;
  tone?: "default" | "live";
  children: React.ReactNode;
}) => (
  <section
    className="px-5 py-6 flex flex-col gap-4"
    style={{
      border: `1px solid ${tone === "live" ? "rgba(188, 255, 91, 0.5)" : "rgba(255, 62, 201, 0.35)"}`,
      background: "rgba(10, 15, 36, 0.55)",
      borderRadius: 8,
      boxShadow: tone === "live" ? "0 0 24px rgba(188, 255, 91, 0.2)" : undefined,
    }}
  >
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="slop-mono text-[11px] uppercase tracking-widest"
        style={{ color: tone === "live" ? "var(--slop-lime)" : "var(--slop-magenta)" }}
      >
        {label}
      </span>
    </div>
    <h2
      className="m-0 uppercase"
      style={{
        color: "var(--slop-text)",
        fontFamily: "var(--slop-font-display)",
        fontSize: "clamp(18px, 2.6vw, 22px)",
      }}
    >
      {title}
    </h2>
    <div className="flex flex-col gap-3">{children}</div>
  </section>
);

const LiveStatusPanel = ({ liveEpisode, onChange }: { liveEpisode: Episode | undefined; onChange: () => void }) => {
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });
  const isLive = !!liveEpisode && !isZeroEpisode(liveEpisode);

  const goOffline = async () => {
    try {
      await writeContractAsync({ functionName: "goOffline" });
      onChange();
    } catch (e) {
      console.warn("goOffline failed", e);
    }
  };

  if (!isLive) {
    return (
      <Section label={"// live status"} title="off air">
        <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
          no episode is currently marked live. use the form below to start a show.
        </p>
      </Section>
    );
  }

  const ep = liveEpisode!;
  return (
    <Section label={"// live now"} title={ep.name || "untitled"} tone="live">
      <KV k="id" v={ep.id} />
      <KV k="slug" v={ep.slug || "—"} />
      <KV k="manifest" v={ep.manifest || "(empty — set after finalize)"} />
      <KV k="contract" v={ep.contractAddr} />
      <KV k="datetime" v={`${formatDate(ep.datetime)} (unix ${ep.datetime.toString()})`} />
      <div className="flex flex-wrap gap-3 pt-2">
        <Button onClick={() => void goOffline()} disabled={isMining}>
          {isMining ? "..." : "End show (go offline)"}
        </Button>
      </div>
    </Section>
  );
};

// Wraps the relay's /admin/recording + /admin/finalize endpoints. The flow:
//
//   1. "Check recording" → GET /admin/recording → shows latest file on disk.
//   2. "Pin to IPFS"     → POST /admin/finalize → streams NDJSON progress
//                          (phase: starting | uploading | done | error)
//                          from the relay's local kubo daemon, ending in a
//                          CID. We render LoadingBar against the bytes/total.
//   3. "Save url on-chain" → setEpisodeUrl(liveId, `ipfs://CID`).
//
// Auth piggybacks on the slop_session cookie the relay set when the host
// signed in via SIWE on live.slop.computer — same cookie because both
// subdomains share `slop.computer` as eTLD+1. If the host isn't signed in
// there yet the relay returns 401 and we surface a link.
type RecordingInfo = {
  name: string;
  sizeBytes: number;
  mtime: number;
};

// Public per-room snapshot from the relay's GET /v1/rooms/:slug/meta. We only
// consume `wallet` here (to auto-fill the episode contract during finalize),
// but the endpoint also returns name/createdAt/live/stt/card for other uses.
type RelayRoomMeta = {
  wallet: { address: string; label: string; chains: number[] } | null;
};

type FinalizeEvent =
  | { phase: "starting"; file: string; name: string; totalBytes: number }
  | { phase: "remuxing" }
  | { phase: "uploading"; bytes: number; totalBytes: number }
  | { phase: "pinning-chat"; messageCount: number }
  | { phase: "pinning-transcript"; segmentCount: number }
  | { phase: "pinning-card"; sizeBytes: number }
  | { phase: "generating-meta" }
  | { phase: "pinning-manifest" }
  | {
      phase: "done";
      cid: string;
      manifestCid: string;
      file: string;
      name: string;
      sizeBytes: number;
      mtime: number;
    }
  | { phase: "error"; message: string };

const FinalizePanel = ({
  episodes,
  liveEpisode,
  onUrlUpdated,
}: {
  episodes: readonly Episode[];
  liveEpisode: Episode | undefined;
  onUrlUpdated: () => void;
}) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [cid, setCid] = useState("");
  const [manifestCid, setManifestCid] = useState("");
  const [checking, setChecking] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [bytesPinned, setBytesPinned] = useState(0);
  const [pinTotal, setPinTotal] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("starting…");
  const [error, setError] = useState("");
  // Clip generation (POST /admin/generate-clips): the relay spawns clawd-clipper.
  const [clipping, setClipping] = useState(false);
  const [clipLine, setClipLine] = useState("");
  // Phase-weighted progress parsed from the clipper's streamed log lines.
  const [clipProg, setClipProg] = useState(initialClipProgress);
  // Episode contract address — points the on-chain `contractAddr` at whatever
  // wallet / contract gets deployed during the show (e.g. a session wallet).
  // Mutable via setEpisodeContract any time. Initialized in the effect below
  // so changing the picker refreshes the displayed value.
  const [newContract, setNewContract] = useState(ZERO_ADDRESS);
  // The session wallet (if any) the relay reports as deployed in this
  // episode's room. Drives the "deployed wallet detected" cue + the pre-fill.
  const [detectedWallet, setDetectedWallet] = useState<{ address: string; label: string } | null>(null);
  // Guards against a slow meta fetch for a previous target landing after the
  // host has already switched episodes (last request wins).
  const walletReqId = useRef(0);
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

  // The episode being finalized. Defaults to the live one (the in-show
  // common case); when offline, defaults to the latest episode so a past
  // show can be re-finalized. selectedId overrides once the host picks.
  const liveId = liveEpisode && !isZeroEpisode(liveEpisode) ? liveEpisode.id : null;
  const target = episodes.find(e => e.id === selectedId) ?? episodes.find(e => e.id === liveId) ?? episodes[0];

  // Ask the relay whether a session wallet was deployed in this episode's
  // room (public, cookieless endpoint — works cross-origin and for re-
  // finalizing old shows). When `allowPrefill`, drop the address into the
  // contract box, but only if nothing's set on-chain and the host hasn't
  // already typed something — never clobber a deliberate value.
  const loadRoomWallet = async (forSlug: string, allowPrefill: boolean) => {
    const reqId = ++walletReqId.current;
    try {
      const res = await fetch(`${RELAY_HTTP_URL}/v1/rooms/${encodeURIComponent(forSlug)}/meta`);
      if (reqId !== walletReqId.current || !res.ok) return;
      const meta = (await res.json()) as RelayRoomMeta;
      if (reqId !== walletReqId.current) return;
      const raw = meta.wallet?.address;
      if (!raw || raw.toLowerCase() === ZERO_ADDRESS) return setDetectedWallet(null);
      let addr: string;
      try {
        addr = getAddress(raw); // checksum for clean display; throws on garbage
      } catch {
        return;
      }
      setDetectedWallet({ address: addr, label: meta.wallet?.label ?? "" });
      if (allowPrefill) setNewContract(prev => (prev.toLowerCase() === ZERO_ADDRESS ? addr : prev));
    } catch {
      /* relay unreachable / no meta — silent, this is a convenience */
    }
  };

  // Sync the contract input to the on-chain value whenever the picked target
  // changes, then check the room for a freshly-deployed session wallet to
  // pre-fill. Lives above the early-return so hook order is stable across
  // renders — the inner `if (target)` keeps it a no-op when episodes is empty.
  useEffect(() => {
    if (!target) return;
    setNewContract(target.contractAddr);
    setDetectedWallet(null);
    void loadRoomWallet(relaySlug(target), target.contractAddr.toLowerCase() === ZERO_ADDRESS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  if (!target) return null;
  const isReFinalize = target.manifest.length > 0;

  // Drop pin results when switching episodes so a stale cid from a prior
  // target can't be saved against the wrong episode.
  const onSelect = (id: string) => {
    setSelectedId(id);
    setRecording(null);
    setCid("");
    setManifestCid("");
    setBytesPinned(0);
    setPinTotal(0);
    setError("");
  };

  const saveContract = async () => {
    setError("");
    if (!isAddress(newContract)) return setError("contract address invalid");
    try {
      await writeContractAsync({
        functionName: "setEpisodeContract",
        args: [target.id, newContract as `0x${string}`],
      });
      onUrlUpdated();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  const handle401 = (): string =>
    `Not signed in as host on the relay. Visit ${RELAY_HTTP_URL} and sign in with this wallet first.`;

  const check = async () => {
    setError("");
    setChecking(true);
    try {
      const res = await fetch(`${RELAY_HTTP_URL}/admin/recording`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) setError(handle401());
        else setError(`relay returned ${res.status}`);
        return;
      }
      const j = (await res.json()) as { latest: RecordingInfo | null };
      setRecording(j.latest);
      // Re-pull room meta — a session wallet may have been deployed after the
      // panel first loaded (common: deploy mid-show, then finalize).
      void loadRoomWallet(relaySlug(target), target.contractAddr.toLowerCase() === ZERO_ADDRESS);
      if (!j.latest) setError("no recording on disk yet — MediaMTX writes when the host is publishing");
    } catch (e) {
      setError((e as Error).message || "check failed");
    } finally {
      setChecking(false);
    }
  };

  const pin = async () => {
    setError("");
    setCid("");
    setManifestCid("");
    setBytesPinned(0);
    setPinTotal(0);
    setPhaseLabel("starting…");
    setPinning(true);
    try {
      // ?slug= is REQUIRED — /admin/finalize resolves the room via
      // roomFromReq. Use `relaySlug(target)` (== liveSlug || slug) so the
      // relay reads the room the show ACTUALLY ran in. Missing slug or
      // wrong slug → finalizes an empty room, pins a manifest with no
      // chat/transcript/participants/card/meta.
      const res = await fetch(`${RELAY_HTTP_URL}/admin/finalize?slug=${encodeURIComponent(relaySlug(target))}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        if (res.status === 401) setError(handle401());
        else setError(`relay returned ${res.status}`);
        return;
      }
      // Stream NDJSON: one JSON object per line. Each line is a FinalizeEvent.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalCid = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: FinalizeEvent;
          try {
            ev = JSON.parse(line) as FinalizeEvent;
          } catch {
            continue;
          }
          if (ev.phase === "starting") {
            setPinTotal(ev.totalBytes);
            setRecording({ name: ev.name, sizeBytes: ev.totalBytes, mtime: Date.now() });
            setPhaseLabel("preparing…");
          } else if (ev.phase === "remuxing") {
            // Reset bytes/total so the bar flips to indeterminate during phases
            // that don't have byte progress — otherwise it would stay pinned at
            // the previous phase's 100% and look stuck.
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel("remuxing fmp4 → mp4…");
          } else if (ev.phase === "uploading") {
            setBytesPinned(ev.bytes);
            if (ev.totalBytes > 0) setPinTotal(ev.totalBytes);
            setPhaseLabel("uploading video to IPFS…");
          } else if (ev.phase === "pinning-chat") {
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel(`pinning chat archive · ${ev.messageCount} messages…`);
          } else if (ev.phase === "pinning-transcript") {
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel(`pinning transcript · ${ev.segmentCount} segments…`);
          } else if (ev.phase === "pinning-card") {
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel(`pinning card · ${formatBytes(ev.sizeBytes)}…`);
          } else if (ev.phase === "generating-meta") {
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel("generating episode metadata (AI pass — can take 30s+)…");
          } else if (ev.phase === "pinning-manifest") {
            setBytesPinned(0);
            setPinTotal(0);
            setPhaseLabel("pinning manifest…");
          } else if (ev.phase === "done") {
            finalCid = ev.cid;
            setCid(ev.cid);
            setManifestCid(ev.manifestCid);
            setRecording({ name: ev.name, sizeBytes: ev.sizeBytes, mtime: ev.mtime });
            setBytesPinned(ev.sizeBytes);
            setPinTotal(ev.sizeBytes);
          } else if (ev.phase === "error") {
            setError(ev.message);
          }
        }
      }
      if (!finalCid && !error) setError("finalize ended without a CID");
    } catch (e) {
      setError((e as Error).message || "pin failed");
    } finally {
      setPinning(false);
    }
  };

  const saveManifest = async () => {
    setError("");
    const url = `ipfs://${manifestCid}`;
    try {
      await writeContractAsync({ functionName: "setManifest", args: [target.id, url] });
      onUrlUpdated();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  // Generate 9:16 clips for this (finalized) episode: the relay spawns the
  // clipper, which cuts + pins the clips and folds them into a new manifest. We
  // stream its progress and, on `done`, drop the new manifest CID into
  // `manifestCid` so the existing "Save manifest on-chain" button signs it.
  const generateClips = async () => {
    setError("");
    setClipLine("");
    setClipProg(initialClipProgress);
    setClipping(true);
    try {
      const res = await fetch(`${RELAY_HTTP_URL}/admin/generate-clips?slug=${encodeURIComponent(target.slug)}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        if (res.status === 401) setError(handle401());
        else if (res.status === 501) setError("clipper isn't configured on the relay (set CLIPPER_DIR)");
        else if (res.status === 409) setError("a clip job is already running for this episode");
        else setError(`relay returned ${res.status}`);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotManifest = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: {
            phase: string;
            line?: string;
            slug?: string;
            manifestCid?: string;
            count?: number;
            message?: string;
          };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.phase === "starting") setClipLine(`cutting clips for ${ev.slug}… (a few minutes)`);
          else if (ev.phase === "log") {
            setClipLine(ev.line ?? "");
            setClipProg(s => advanceClipProgress(s, ev.line));
          } else if (ev.phase === "done") {
            gotManifest = true;
            setManifestCid(String(ev.manifestCid ?? "").replace(/^ipfs:\/\//, ""));
            setClipLine(`✓ ${ev.count ?? ""} clips pinned — save the updated manifest below`);
            setClipProg(finishClipProgress);
          } else if (ev.phase === "error") setError(ev.message ?? "clip job failed");
        }
      }
      if (!gotManifest && !error) setError("clip job ended without a manifest CID");
    } catch (e) {
      setError((e as Error).message || "clip job failed");
    } finally {
      setClipping(false);
    }
  };

  // Percentage for the LoadingBar. Falls back to indeterminate (undefined)
  // until we know totalBytes — kubo starts emitting Bytes within milliseconds
  // so this is brief.
  const pct = pinTotal > 0 ? Math.min(100, (bytesPinned / pinTotal) * 100) : undefined;

  return (
    <Section label={"// finalize"} title="Pin recording → IPFS → update episode manifest">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        pull the latest MediaMTX recording, pin it + the room&apos;s chat/transcript to our self-hosted IPFS node, and
        write the manifest CID on-chain. works on a past episode too — re-finalize regenerates the manifest (transcript
        + AI description/one-liner). host session cookie on {RELAY_HTTP_URL} is required.
      </p>

      <label className="flex flex-col gap-1">
        <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
          episode {isReFinalize ? "(re-finalize — already has a manifest)" : ""}
        </span>
        <select
          value={target.id}
          onChange={e => onSelect(e.target.value)}
          className="slop-textfield"
          disabled={pinning}
        >
          {episodes.map(ep => (
            <option key={ep.id} value={ep.id}>
              {(ep.name || ep.slug || "untitled") + (ep.id === liveId ? " · live" : "")}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void check()} disabled={checking || pinning}>
          {checking ? "..." : "Check recording"}
        </Button>
        <Button onClick={() => void pin()} disabled={pinning || checking}>
          {pinning ? "Pinning…" : "Pin to IPFS"}
        </Button>
      </div>

      {pinning || (pinTotal > 0 && !cid) ? (
        <div
          className="px-3 py-3 flex flex-col gap-2"
          style={{ border: "1px dashed rgba(255, 62, 201, 0.35)", background: "rgba(0,0,0,0.25)" }}
        >
          <LoadingBar
            cells={24}
            // Only switch into determinate mode once we're actually
            // uploading — remux runs first with no byte-progress and
            // would otherwise sit at 0% looking stuck.
            progress={bytesPinned > 0 ? pct : undefined}
            caption={
              bytesPinned > 0 && pinTotal > 0 ? (
                <span className="slop-mono text-[11px]">
                  {formatBytes(bytesPinned)} / {formatBytes(pinTotal)}
                  {pct !== undefined ? ` · ${Math.round(pct)}%` : ""}
                </span>
              ) : (
                <span className="slop-mono text-[11px]">{phaseLabel}</span>
              )
            }
          />
        </div>
      ) : null}

      {recording && !pinning ? (
        <div
          className="px-3 py-3 flex flex-col gap-2"
          style={{ border: "1px dashed rgba(255, 62, 201, 0.2)", background: "rgba(0,0,0,0.25)" }}
        >
          <KV k="file" v={recording.name} />
          <KV k="size" v={formatBytes(recording.sizeBytes)} />
          <KV k="mtime" v={new Date(recording.mtime).toLocaleString()} />
        </div>
      ) : null}

      {cid ? (
        <div
          className="px-3 py-3 flex flex-col gap-3"
          style={{ border: "1px solid rgba(188, 255, 91, 0.4)", background: "rgba(10, 15, 36, 0.4)" }}
        >
          <KV k="video cid" v={cid} />
          <KV k="manifest cid" v={manifestCid} />
          <KV k="next manifest" v={`ipfs://${manifestCid}`} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => void saveManifest()}
              disabled={isMining || !manifestCid || `ipfs://${manifestCid}` === target.manifest}
            >
              {isMining ? "Signing…" : "Save manifest on-chain"}
            </Button>
            <a
              className="slop-link slop-mono text-[11px] self-center"
              // The `?filename` hint makes kubo's gateway emit
              // Content-Disposition: inline; filename=... so browsers
              // play the mp4 in-page instead of forcing a download.
              href={`https://media.slop.computer/ipfs/${cid}?filename=${encodeURIComponent(recording?.name ?? "episode.mp4")}`}
              target="_blank"
              rel="noreferrer"
            >
              play video ↗
            </a>
            <a
              className="slop-link slop-mono text-[11px] self-center"
              href={`https://media.slop.computer/ipfs/${manifestCid}`}
              target="_blank"
              rel="noreferrer"
            >
              inspect manifest ↗
            </a>
          </div>
        </div>
      ) : null}

      {/* Clips: generate the 9:16 clips + tweets for a finalized episode, pin to
          bgipfs, fold into the manifest. Available once the episode has a video
          manifest. On done the new manifest CID lands in `manifestCid` above. */}
      {isReFinalize ? (
        <div
          className="px-3 py-3 flex flex-col gap-2"
          style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)", marginTop: 4 }}
        >
          <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
            {"// clips (9:16 + tweets)"}
          </span>
          <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
            cut the vertical clips for this episode on the relay, pin them to IPFS, and fold them into the manifest.
            takes a few minutes. when it finishes the new manifest CID fills in below — hit{" "}
            <strong>Save manifest on-chain</strong> to publish it (you can also paste a CID the clipper printed). clips
            only show to admins on the episode page.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void generateClips()} disabled={clipping}>
              {clipping ? "Generating clips…" : "Generate clips"}
            </Button>
            {clipProg.done && clipLine ? (
              <span className="slop-mono text-[11px] break-all" style={{ color: "var(--slop-lime)" }}>
                {clipLine}
              </span>
            ) : null}
          </div>
          {clipping || clipProg.overall > 0 ? <ClipProgress state={clipProg} /> : null}
          {/* Manifest CID to publish — auto-filled by Generate clips, or paste one
              (e.g. printed by the clipper). Saving = setManifest(episode.id, ipfs://CID). */}
          <label className="flex flex-col gap-1 mt-1">
            <span
              className="slop-mono text-[10px] uppercase tracking-widest"
              style={{ color: "var(--slop-text-muted)" }}
            >
              manifest CID (with clips)
            </span>
            <input
              className="slop-textfield"
              value={manifestCid}
              onChange={e => setManifestCid(e.target.value.replace(/^ipfs:\/\//, "").trim())}
              placeholder="Qm… (auto-fills after Generate clips, or paste one)"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => void saveManifest()}
              disabled={isMining || !manifestCid || `ipfs://${manifestCid}` === target.manifest}
            >
              {isMining ? "Signing…" : "Save manifest on-chain"}
            </Button>
            {manifestCid ? (
              <a
                className="slop-link slop-mono text-[11px] self-center"
                href={`https://media.slop.computer/ipfs/${manifestCid}`}
                target="_blank"
                rel="noreferrer"
              >
                inspect manifest ↗
              </a>
            ) : null}
            {`ipfs://${manifestCid}` === target.manifest && manifestCid ? (
              <span className="slop-mono text-[11px]" style={{ color: "var(--slop-lime)" }}>
                ✓ already the live manifest
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className="px-3 py-3 flex flex-col gap-2"
        style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)", marginTop: 4 }}
      >
        <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
          {"// episode contract"}
        </span>
        <p className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          point the on-chain <code>contractAddr</code> at whatever the show is about — a session wallet deployed
          mid-show, a per-episode contract, etc. mutable any time. <code>0x0…0</code> = none.
        </p>
        {detectedWallet ? (
          <div
            className="slop-mono text-[11px] flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5"
            style={{ border: "1px solid rgba(188, 255, 91, 0.5)", background: "rgba(188, 255, 91, 0.06)" }}
          >
            <span style={{ color: "var(--slop-lime)" }}>
              🔑 wallet deployed in room{detectedWallet.label ? ` · ${detectedWallet.label}` : ""}
            </span>
            <code style={{ color: "var(--slop-text)" }}>{detectedWallet.address}</code>
            {newContract.toLowerCase() === detectedWallet.address.toLowerCase() ? (
              <span style={{ color: "var(--slop-text-muted)" }}>↳ pre-filled — just hit Save</span>
            ) : (
              <button type="button" className="slop-link" onClick={() => setNewContract(detectedWallet.address)}>
                use this →
              </button>
            )}
          </div>
        ) : null}
        <AddressField
          label="contract address"
          value={newContract}
          onChange={setNewContract}
          placeholder={ZERO_ADDRESS}
        />
        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            onClick={() => void saveContract()}
            disabled={isMining || newContract.toLowerCase() === target.contractAddr.toLowerCase()}
          >
            {isMining ? "Signing…" : "Save contract on-chain"}
          </Button>
          <span className="slop-mono text-[10px] self-center" style={{ color: "var(--slop-text-muted)" }}>
            current: {target.contractAddr}
          </span>
        </div>
      </div>

      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
    </Section>
  );
};

const AddFutureEpisodeForm = ({
  onDone,
  prefill,
}: {
  onDone: () => void;
  prefill?: { slug: string; datetime: string } | null;
}) => {
  // Lazy useState so we read prefill only on first mount — once filled in,
  // the user is in charge of edits even if the URL param hangs around.
  const [name, setName] = useState(() => prefill?.slug ?? "");
  const [slug, setSlug] = useState(() => prefill?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  // liveSlug is the relay-room slug (live.slop.computer/<liveSlug>). Empty
  // means "same as slug". URL prefill targets this — host can then edit
  // name/slug to be more descriptive while liveSlug keeps pointing at the
  // existing studio room.
  const [liveSlug, setLiveSlug] = useState(() => prefill?.slug ?? "");
  // Default to "now" so the contract gets a real datetime (it's part of
  // getId and immutable post-add). Clear the field to schedule with 0.
  // Prefill pushes it out to "now + 1h" — gives the host a window to set
  // up OBS without immediately broadcasting an in-the-past airtime.
  const [datetime, setDatetime] = useState(() => prefill?.datetime ?? toLocalDatetimeValue(new Date()));
  const [error, setError] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("name required");
    if (!slug.trim() || !/^[a-z0-9-]{1,64}$/.test(slug)) return setError("slug must be 1-64 chars of [a-z0-9-]");
    if (liveSlug && !/^[a-z0-9-]{1,64}$/.test(liveSlug)) return setError("live slug must be 1-64 chars of [a-z0-9-]");
    let unix = 0;
    if (datetime) {
      const t = Math.floor(new Date(datetime).getTime() / 1000);
      if (!Number.isFinite(t) || t <= 0) return setError("datetime invalid");
      unix = t;
    }
    try {
      await writeContractAsync({
        functionName: "addEpisode",
        args: [name.trim(), slug, liveSlug, "", ZERO_ADDRESS, BigInt(unix)],
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setLiveSlug("");
      setDatetime("");
      onDone();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  return (
    <Section label={"// schedule"} title="Add a future episode">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        registers the slug on-chain without going live. slop.computer/&lt;slug&gt; becomes browsable as a placeholder.
        flip it live later from the row below when the stream is up.
      </p>
      <FormField label="name" value={name} onChange={onNameChange} placeholder="ep 004 · <topic and guest>" />
      <FormField
        label="slug (URL: slop.computer/<slug>)"
        value={slug}
        onChange={v => {
          setSlug(v);
          setSlugTouched(true);
        }}
        placeholder="ep-004-<guest>"
        mono
      />
      <FormField
        label="live slug (live.slop.computer/<liveSlug> — leave empty to reuse slug)"
        value={liveSlug}
        onChange={setLiveSlug}
        placeholder="(same as slug)"
        mono
      />
      <FormField label="datetime (local, optional)" value={datetime} onChange={setDatetime} type="datetime-local" />
      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button onClick={() => void submit()} disabled={isMining}>
          {isMining ? "Signing…" : "Schedule episode"}
        </Button>
      </div>
    </Section>
  );
};

const GoLiveForm = ({ onDone }: { onDone: () => void }) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contractAddr, setContractAddr] = useState(ZERO_ADDRESS);
  const [datetime, setDatetime] = useState(toLocalDatetimeValue(new Date()));
  const [error, setError] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("name required");
    if (!slug.trim() || !/^[a-z0-9-]{1,64}$/.test(slug)) return setError("slug must be 1-64 chars of [a-z0-9-]");
    if (!isAddress(contractAddr)) return setError("contract address invalid");
    const unix = Math.floor(new Date(datetime).getTime() / 1000);
    if (!Number.isFinite(unix) || unix <= 0) return setError("datetime invalid");
    try {
      // manifest stays empty while live — the audience watches HLS, the
      // finalize panel publishes the manifest CID after the show.
      await writeContractAsync({
        functionName: "goLive",
        // liveSlug = "" → relay room defaults to `slug`. For divergent
        // studio-room setups, use Add a future episode first then setLive.
        args: [name.trim(), slug, "", "", contractAddr as `0x${string}`, BigInt(unix)],
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      onDone();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  return (
    <Section label={"// go live"} title="Start a new live show">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        creates a new episode at the head of the list AND marks it live. while live, audience sees the HLS stream from
        media.slop.computer. after the show, hit the Finalize panel to pin the recording + publish the manifest cid.
      </p>
      <FormField
        label="name"
        value={name}
        onChange={onNameChange}
        placeholder="ep 003 · agents and the death of the email signup"
      />
      <FormField
        label="slug (URL: slop.computer/<slug>)"
        value={slug}
        onChange={v => {
          setSlug(v);
          setSlugTouched(true);
        }}
        placeholder="ep-003-agents"
        mono
      />
      <AddressField label="contract" value={contractAddr} onChange={setContractAddr} placeholder={ZERO_ADDRESS} />
      <FormField label="datetime (local)" value={datetime} onChange={setDatetime} type="datetime-local" />
      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button variant="primary" onClick={() => void submit()} disabled={isMining}>
          {isMining ? "Signing…" : "◉ Go Live on slop.computer"}
        </Button>
      </div>
    </Section>
  );
};

const AddEpisodeForm = ({ onDone }: { onDone: () => void }) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [contractAddr, setContractAddr] = useState(ZERO_ADDRESS);
  const [manifest, setManifest] = useState("");
  const [datetime, setDatetime] = useState(toLocalDatetimeValue(new Date()));
  const [error, setError] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("name required");
    if (!slug.trim() || !/^[a-z0-9-]{1,64}$/.test(slug)) return setError("slug must be 1-64 chars of [a-z0-9-]");
    if (!isAddress(contractAddr)) return setError("contract address invalid");
    const unix = Math.floor(new Date(datetime).getTime() / 1000);
    if (!Number.isFinite(unix) || unix <= 0) return setError("datetime invalid");
    try {
      await writeContractAsync({
        functionName: "addEpisode",
        // liveSlug = "" → relay room defaults to `slug`. Backfill form
        // doesn't need to set it; host can setLiveSlug per row if needed.
        args: [name.trim(), slug, "", manifest.trim(), contractAddr as `0x${string}`, BigInt(unix)],
      });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setManifest("");
      onDone();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  return (
    <Section label={"// add episode"} title="Add a past / placeholder episode">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        appends to the head of the list without touching the live pointer. use this to backfill past shows or seed
        placeholder content. manifest can be empty and populated later via setManifest.
      </p>
      <FormField
        label="name"
        value={name}
        onChange={onNameChange}
        placeholder="ep 001 · why every podcast is now an agent"
      />
      <FormField
        label="slug (URL: slop.computer/<slug>)"
        value={slug}
        onChange={v => {
          setSlug(v);
          setSlugTouched(true);
        }}
        placeholder="ep-001-agents"
        mono
      />
      <AddressField label="contract" value={contractAddr} onChange={setContractAddr} placeholder={ZERO_ADDRESS} />
      <FormField
        label="manifest (ipfs://CID — optional)"
        value={manifest}
        onChange={setManifest}
        placeholder="ipfs://bafy…"
        mono
      />
      <FormField label="datetime (local)" value={datetime} onChange={setDatetime} type="datetime-local" />
      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button onClick={() => void submit()} disabled={isMining}>
          {isMining ? "Signing…" : "Add episode"}
        </Button>
      </div>
    </Section>
  );
};

// Legacy single-coin (ETH / coinType 60) setter on the ENS public resolver.
const RESOLVER_SETADDR_ABI = [
  {
    type: "function",
    name: "setAddr",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "a", type: "address" },
    ],
    outputs: [],
  },
] as const;

// EIP-1577 contenthash get/set on the ENS public resolver. `contenthash` is
// the website record — eth.limo (and the .eth.link / native ENS gateways)
// read it and serve whatever it points at. We only ever write an ipfs:// CID.
const RESOLVER_CONTENTHASH_ABI = [
  {
    type: "function",
    name: "setContenthash",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "hash", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "contenthash",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes" }],
  },
] as const;

// The CID from the most recent `yarn ipfs` run — pre-fills the box so the
// happy path is "open /admin → hit the button → sign". Paste a fresh CID here
// (or in the box) after each app redeploy. New EPISODES don't need a redeploy:
// the static export reads the registry contract client-side at runtime, so a
// pin from weeks ago still shows today's episodes. You only re-run this loop
// when the app code itself changes.
const PLACEHOLDER_WEBSITE_CID = "bafybeifcidzdaw3pgglmj2k2zu663vwwgasfe565nlil7546owptfaxjei";

const stripCid = (raw: string): string =>
  raw
    .trim()
    .replace(/^ipfs:\/\//i, "")
    .replace(/\/+$/, "");

// ipfs:// CID (v0 or v1) → EIP-1577 contenthash bytes. The protocol prefix
// 0xe301 is the unsigned-varint of the `ipfs-ns` multicodec (0xe3); the rest
// is the raw CIDv1 bytes. `.toV1()` normalizes a pasted Qm… (v0) so the gateways
// resolve it. Throws on a malformed CID — caller surfaces the error.
function cidToContenthash(rawCid: string): `0x${string}` {
  const cid = CID.parse(stripCid(rawCid)).toV1();
  const hex = Array.from(cid.bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `0xe301${hex}`;
}

// Reverse of the above, for showing the live record. Returns the CID string,
// or null if the record is empty / not an ipfs-ns contenthash (e.g. ipns,
// swarm) — we only display+manage ipfs here.
function contenthashToCid(hash: string | undefined | null): string | null {
  if (!hash) return null;
  const lower = hash.toLowerCase();
  if (!lower.startsWith("0xe301")) return null;
  try {
    const body = lower.slice(6);
    const bytes = new Uint8Array(body.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
    return CID.decode(bytes).toString();
  } catch {
    return null;
  }
}

const sameCid = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) return false;
  try {
    return CID.parse(stripCid(a)).toV1().toString() === CID.parse(stripCid(b)).toV1().toString();
  } catch {
    return false;
  }
};

// Wires up the contract's ENS name in BOTH directions — they're two separate
// records and two separate txs:
//   forward (name → contract): setAddr on the name's resolver. Signed by the
//     ENS name owner (assumed to be the connected wallet).
//   reverse (contract → name): SlopComputer.setName via the ReverseRegistrar.
//     Signed by the contract owner.
const SetNamePanel = () => {
  const [name, setName] = useState("slopcomputer.eth");
  const publicClient = usePublicClient();

  // forward — name's address record → this contract
  const { writeContractAsync: writeForward } = useWriteContract();
  const [fwdBusy, setFwdBusy] = useState(false);
  const [fwdError, setFwdError] = useState("");
  const [fwdDone, setFwdDone] = useState(false);

  // reverse — contract's primary name → this name
  const { writeContractAsync: writeReverse, isMining: revMining } = useScaffoldWriteContract({
    contractName: "SlopComputer",
  });
  const [revError, setRevError] = useState("");
  const [revDone, setRevDone] = useState(false);

  // Live: what does the name's address record currently point at? undefined =
  // loading, null = no record / resolve failed.
  const [currentAddr, setCurrentAddr] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const n = name.trim();
    if (!n || !publicClient) {
      setCurrentAddr(null);
      return;
    }
    setCurrentAddr(undefined);
    (async () => {
      try {
        const addr = await publicClient.getEnsAddress({ name: normalize(n) });
        if (!cancelled) setCurrentAddr(addr);
      } catch {
        if (!cancelled) setCurrentAddr(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, publicClient, fwdDone]);

  const pointsHere = !!currentAddr && currentAddr.toLowerCase() === CONTRACT_ADDRESS.toLowerCase();

  const setForward = async () => {
    setFwdError("");
    setFwdDone(false);
    const n = name.trim();
    if (!n) return setFwdError("ens name required");
    if (!publicClient) return setFwdError("no rpc client");
    let normalized: string;
    let node: `0x${string}`;
    try {
      normalized = normalize(n);
      node = namehash(normalized);
    } catch {
      return setFwdError("invalid ens name");
    }
    setFwdBusy(true);
    try {
      const resolver = await publicClient.getEnsResolver({ name: normalized });
      if (!resolver || resolver === ZERO_ADDRESS) {
        setFwdError("no resolver set for this name — set one in the ENS app first");
        return;
      }
      await writeForward({
        address: resolver,
        abi: RESOLVER_SETADDR_ABI,
        functionName: "setAddr",
        args: [node, CONTRACT_ADDRESS],
      });
      setFwdDone(true);
    } catch (e) {
      setFwdError((e as Error).message || "tx failed (is this wallet the owner/manager of the ENS name?)");
    } finally {
      setFwdBusy(false);
    }
  };

  const setReverse = async () => {
    setRevError("");
    setRevDone(false);
    const n = name.trim();
    if (!n) return setRevError("ens name required");
    try {
      await writeReverse({ functionName: "setName", args: [n] });
      setRevDone(true);
    } catch (e) {
      setRevError((e as Error).message || "tx failed");
    }
  };

  const label = name.trim() || "name";
  const subLabel = "slop-mono text-[11px] uppercase tracking-widest";

  return (
    <Section label={"// ens · primary name"} title="Wire up the contract's ENS name">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        two independent records, one tx each. <strong>forward</strong> points the name at this contract (you sign as the
        ENS name owner); <strong>reverse</strong> claims the name as the contract&apos;s primary (you sign as the
        contract owner).
      </p>
      <FormField label="ens name" value={name} onChange={setName} placeholder="slopcomputer.eth" mono />
      <KV
        k="resolves to"
        v={
          currentAddr === undefined
            ? "…"
            : currentAddr
              ? `${currentAddr}${pointsHere ? "   ✓ this contract" : "   ✗ not this contract"}`
              : "(no address record)"
        }
      />

      {/* 1 · forward */}
      <div className="flex flex-col gap-2 pt-1">
        <span className={subLabel} style={{ color: "var(--slop-magenta)" }}>
          {"// 1 · forward — "}
          {label} → contract
        </span>
        <span className="slop-mono text-[11px] break-all" style={{ color: "var(--slop-text-muted)" }}>
          sets {label}&apos;s ETH address record to {CONTRACT_ADDRESS}
        </span>
        {fwdError ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
            {fwdError}
          </div>
        ) : null}
        {fwdDone ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-lime)" }}>
            forward record set ✓
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void setForward()} disabled={fwdBusy || pointsHere}>
            {fwdBusy ? "Signing…" : pointsHere ? "Already points here ✓" : `Point ${label} → contract`}
          </Button>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)" }} className="my-1" />

      {/* 2 · reverse */}
      <div className="flex flex-col gap-2">
        <span className={subLabel} style={{ color: "var(--slop-magenta)" }}>
          {"// 2 · reverse — contract → "}
          {label}
        </span>
        <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          claims the reverse record (addr.reverse) so explorers show {label} instead of the raw address
        </span>
        {revError ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
            {revError}
          </div>
        ) : null}
        {revDone ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-lime)" }}>
            primary name set ✓
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void setReverse()} disabled={revMining}>
            {revMining ? "Signing…" : `Set ${label} as primary name`}
          </Button>
        </div>
      </div>
    </Section>
  );
};

// Sets the ENS `contenthash` (website) record so slopcomputer.eth.limo mirrors
// the slop.computer build. Signed by the ENS NAME owner/manager (not the
// contract owner) — same resolver as the forward record above. Flow:
//   yarn ipfs (prints a CID) → paste it here → Set website contenthash → sign.
const SetContenthashPanel = () => {
  const [name, setName] = useState("slopcomputer.eth");
  const [cid, setCid] = useState(PLACEHOLDER_WEBSITE_CID);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Live: what CID does the name's contenthash currently point at? undefined =
  // loading, null = no ipfs record. `done` in deps re-reads after a successful tx.
  const [currentCid, setCurrentCid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    const n = name.trim();
    if (!n || !publicClient) {
      setCurrentCid(null);
      return;
    }
    setCurrentCid(undefined);
    (async () => {
      try {
        const normalized = normalize(n);
        const resolver = await publicClient.getEnsResolver({ name: normalized });
        if (!resolver || resolver === ZERO_ADDRESS) {
          if (!cancelled) setCurrentCid(null);
          return;
        }
        const hash = (await publicClient.readContract({
          address: resolver,
          abi: RESOLVER_CONTENTHASH_ABI,
          functionName: "contenthash",
          args: [namehash(normalized)],
        })) as string;
        if (!cancelled) setCurrentCid(contenthashToCid(hash));
      } catch {
        if (!cancelled) setCurrentCid(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [name, publicClient, done]);

  const cleanCid = stripCid(cid);
  const alreadySet = sameCid(currentCid, cleanCid);

  const submit = async () => {
    setError("");
    setDone(false);
    const n = name.trim();
    if (!n) return setError("ens name required");
    if (!cleanCid) return setError("cid required");
    if (!publicClient) return setError("no rpc client");
    let normalized: string;
    let node: `0x${string}`;
    let contenthash: `0x${string}`;
    try {
      normalized = normalize(n);
      node = namehash(normalized);
    } catch {
      return setError("invalid ens name");
    }
    try {
      contenthash = cidToContenthash(cleanCid);
    } catch {
      return setError("invalid CID — paste the bafy… string printed by `yarn ipfs`");
    }
    setBusy(true);
    try {
      const resolver = await publicClient.getEnsResolver({ name: normalized });
      if (!resolver || resolver === ZERO_ADDRESS) {
        setError("no resolver set for this name — set one in the ENS app first");
        return;
      }
      await writeContractAsync({
        address: resolver,
        abi: RESOLVER_CONTENTHASH_ABI,
        functionName: "setContenthash",
        args: [node, contenthash],
      });
      setDone(true);
    } catch (e) {
      setError((e as Error).message || "tx failed (is this wallet the owner/manager of the ENS name?)");
    } finally {
      setBusy(false);
    }
  };

  const label = name.trim() || "name";

  return (
    <Section label={"// ens · website (contenthash)"} title="Mirror the site to slopcomputer.eth.limo">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        points {label}&apos;s <strong>contenthash</strong> at an IPFS build of this site, so <code>{label}.limo</code>{" "}
        serves it. run <code>yarn ipfs</code> to build + pin (it prints a CID), paste it below, then sign as the ENS
        name owner. <strong>new episodes don&apos;t need a redeploy</strong> — the pin reads the registry on-chain at
        runtime; only re-run this when the app code changes.
      </p>
      <FormField label="ens name" value={name} onChange={setName} placeholder="slopcomputer.eth" mono />
      <FormField label="ipfs cid (from `yarn ipfs`)" value={cid} onChange={setCid} placeholder="bafy…" mono />
      <KV
        k="currently"
        v={
          currentCid === undefined
            ? "…"
            : currentCid
              ? `ipfs://${currentCid}${alreadySet ? "   ✓ matches the CID above" : ""}`
              : "(no ipfs contenthash set)"
        }
      />
      {cleanCid ? (
        <div className="flex flex-wrap gap-4">
          <a
            className="slop-link slop-mono text-[11px]"
            href={`https://community.bgipfs.com/ipfs/${cleanCid}`}
            target="_blank"
            rel="noreferrer"
          >
            preview pin on gateway ↗
          </a>
          <a
            className="slop-link slop-mono text-[11px]"
            href={`https://${label}.limo`}
            target="_blank"
            rel="noreferrer"
          >
            open {label}.limo ↗
          </a>
        </div>
      ) : null}
      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
      {done ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-lime)" }}>
          contenthash set ✓ — give the gateways a few minutes, then {label}.limo serves this build
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1">
        <Button variant="primary" onClick={() => void submit()} disabled={busy || !cleanCid || alreadySet}>
          {busy ? "Signing…" : alreadySet ? "Already set to this CID ✓" : "Set website contenthash"}
        </Button>
      </div>
    </Section>
  );
};

// Owner escape hatch (SlopComputer.execute). Recovers ETH or ERC-20s sent
// to the contract by mistake:
//   ETH:    execute(to, amount, "0x")           — contract forwards its own balance
//   ERC-20: execute(token, 0, transfer(to, amt)) — encoded transfer call
const RecoverAssetsPanel = () => {
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

  // --- ETH ---
  const { data: ethBalance, refetch: refetchEth } = useBalance({ address: CONTRACT_ADDRESS, query: READ_QUERY });
  const [ethTo, setEthTo] = useState("");
  const [ethAmount, setEthAmount] = useState("");
  const [ethError, setEthError] = useState("");

  const sendEth = async () => {
    setEthError("");
    if (!isAddress(ethTo)) return setEthError("recipient address invalid");
    let value: bigint;
    try {
      value = parseEther(ethAmount.trim() || "0");
    } catch {
      return setEthError("amount invalid");
    }
    if (value <= 0n) return setEthError("amount must be greater than 0");
    if (ethBalance && value > ethBalance.value) return setEthError("amount exceeds contract balance");
    try {
      await writeContractAsync({ functionName: "execute", args: [getAddress(ethTo), value, "0x"] });
      setEthAmount("");
      void refetchEth();
    } catch (e) {
      setEthError((e as Error).message || "tx failed");
    }
  };

  // --- ERC-20 ---
  const [token, setToken] = useState("");
  const [tokenTo, setTokenTo] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenError, setTokenError] = useState("");
  const tokenIsValid = isAddress(token);
  const tokenAddress = tokenIsValid ? getAddress(token) : undefined;
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: tokenIsValid },
  });
  const { data: tokenSymbol } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: tokenIsValid },
  });
  const { data: tokenBalance, refetch: refetchToken } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [CONTRACT_ADDRESS],
    query: { enabled: tokenIsValid },
  });
  const decimals = tokenDecimals ?? 18;

  const sendToken = async () => {
    setTokenError("");
    if (!tokenIsValid) return setTokenError("token address invalid");
    if (!isAddress(tokenTo)) return setTokenError("recipient address invalid");
    let amount: bigint;
    try {
      amount = parseUnits(tokenAmount.trim() || "0", decimals);
    } catch {
      return setTokenError("amount invalid");
    }
    if (amount <= 0n) return setTokenError("amount must be greater than 0");
    if (tokenBalance !== undefined && amount > tokenBalance) return setTokenError("amount exceeds contract balance");
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [getAddress(tokenTo), amount],
    });
    try {
      await writeContractAsync({ functionName: "execute", args: [getAddress(token), 0n, data] });
      setTokenAmount("");
      void refetchToken();
    } catch (e) {
      setTokenError((e as Error).message || "tx failed");
    }
  };

  return (
    <Section label={"// recover · escape hatch"} title="Recover assets sent to the contract">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        forwards an arbitrary call from the contract (owner-only). use it to sweep ETH or tokens that landed here by
        mistake to a wallet you control.
      </p>

      {/* ETH */}
      <div className="flex flex-col gap-3 pt-1">
        <KV k="eth held" v={ethBalance ? `${formatEther(ethBalance.value)} ETH` : "…"} />
        <AddressField label="send eth to" value={ethTo} onChange={setEthTo} placeholder={ZERO_ADDRESS} />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField label="amount (ETH)" value={ethAmount} onChange={setEthAmount} placeholder="0.0" mono />
          </div>
          <Button
            onClick={() => ethBalance && setEthAmount(formatEther(ethBalance.value))}
            disabled={!ethBalance || ethBalance.value === 0n}
          >
            Max
          </Button>
        </div>
        {ethError ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
            {ethError}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void sendEth()} disabled={isMining}>
            {isMining ? "Signing…" : "Recover ETH"}
          </Button>
        </div>
      </div>

      <div style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)" }} className="my-2" />

      {/* ERC-20 */}
      <div className="flex flex-col gap-3">
        <AddressField label="token contract" value={token} onChange={setToken} placeholder={ZERO_ADDRESS} />
        {tokenIsValid ? (
          <KV
            k="held"
            v={tokenBalance !== undefined ? `${formatUnits(tokenBalance, decimals)} ${tokenSymbol ?? ""}`.trim() : "…"}
          />
        ) : null}
        <AddressField label="send token to" value={tokenTo} onChange={setTokenTo} placeholder={ZERO_ADDRESS} />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField
              label={`amount${tokenSymbol ? ` (${tokenSymbol})` : ""}`}
              value={tokenAmount}
              onChange={setTokenAmount}
              placeholder="0.0"
              mono
            />
          </div>
          <Button
            onClick={() => tokenBalance !== undefined && setTokenAmount(formatUnits(tokenBalance, decimals))}
            disabled={tokenBalance === undefined || tokenBalance === 0n}
          >
            Max
          </Button>
        </div>
        {tokenError ? (
          <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
            {tokenError}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void sendToken()} disabled={isMining}>
            {isMining ? "Signing…" : "Recover token"}
          </Button>
        </div>
      </div>
    </Section>
  );
};

const EpisodeTable = ({
  episodes,
  liveId,
  totalCount,
  onChange,
}: {
  episodes: readonly Episode[] | undefined;
  liveId: `0x${string}` | null;
  totalCount: number | undefined;
  onChange: () => void;
}) => {
  const list = useMemo(() => episodes ?? [], [episodes]);

  if (totalCount === 0) {
    return (
      <Section label={"// episodes"} title="No episodes yet">
        <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
          the registry is empty. add one above to populate the homepage.
        </p>
      </Section>
    );
  }

  return (
    <Section
      label={"// episodes"}
      title={`${totalCount ?? list.length} pinned${totalCount !== list.length ? ` (showing ${list.length})` : ""}`}
    >
      <ul className="flex flex-col">
        {list.map((ep, i) => (
          <EpisodeRow key={ep.id} episode={ep} isLive={ep.id === liveId} divider={i !== 0} onChange={onChange} />
        ))}
      </ul>
    </Section>
  );
};

const EpisodeRow = ({
  episode,
  isLive,
  divider,
  onChange,
}: {
  episode: Episode;
  isLive: boolean;
  divider: boolean;
  onChange: () => void;
}) => {
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });
  const [expanded, setExpanded] = useState(false);
  const [newManifest, setNewManifest] = useState(episode.manifest);
  const [newSlug, setNewSlug] = useState(episode.slug);
  const [newContract, setNewContract] = useState(episode.contractAddr);
  const [error, setError] = useState("");
  // A finalized episode already has its manifest pinned. Re-pointing the live
  // slot at it would let the relay start recording at the same slug and the
  // next finalize would overwrite the published recording — so hide setLive.
  const isFinalized = !!episode.manifest;

  const tx = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  return (
    <li
      className="py-3 flex flex-col gap-2"
      style={{ borderTop: divider ? "1px dashed rgba(255, 62, 201, 0.18)" : undefined }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="slop-mono text-[11px]" style={{ color: isLive ? "var(--slop-lime)" : "var(--slop-magenta)" }}>
          {isLive ? "● live" : "○"}
        </span>
        <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
          {formatDate(episode.datetime)}
        </span>
        <span className="flex-1 min-w-0 truncate text-sm" style={{ color: "var(--slop-text)" }}>
          {episode.name || "untitled"}
        </span>
        <Button as="a" href={`/${episode.slug}`} target="_blank" rel="noreferrer">
          view ↗
        </Button>
        {!isLive && !isFinalized ? (
          <Button
            variant="primary"
            onClick={() => tx(() => writeContractAsync({ functionName: "setLive", args: [episode.id] }))}
            disabled={isMining}
          >
            {isMining ? "…" : "◉ Go Live"}
          </Button>
        ) : null}
        {isFinalized && !isLive ? (
          <span className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
            finalized
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="slop-link slop-mono text-[11px]"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          {expanded ? "collapse" : "edit"}
        </button>
      </div>
      {expanded ? (
        <div
          className="px-3 py-3 flex flex-col gap-3"
          style={{ border: "1px dashed rgba(255, 62, 201, 0.2)", background: "rgba(0,0,0,0.25)" }}
        >
          <KV k="id" v={episode.id} />
          <FormField label="slug" value={newSlug} onChange={setNewSlug} mono />
          <FormField label="manifest (ipfs://CID)" value={newManifest} onChange={setNewManifest} mono />
          <AddressField label="contract" value={newContract} onChange={setNewContract} />
          {error ? (
            <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!/^[a-z0-9-]{1,64}$/.test(newSlug)) {
                  setError("slug must be 1-64 chars of [a-z0-9-]");
                  return;
                }
                void tx(() => writeContractAsync({ functionName: "setSlug", args: [episode.id, newSlug] }));
              }}
              disabled={isMining || newSlug === episode.slug}
            >
              Save slug
            </Button>
            <Button
              onClick={() =>
                tx(() => writeContractAsync({ functionName: "setManifest", args: [episode.id, newManifest] }))
              }
              disabled={isMining || newManifest === episode.manifest}
            >
              Save manifest
            </Button>
            <Button
              onClick={() => {
                if (!isAddress(newContract)) {
                  setError("contract address invalid");
                  return;
                }
                void tx(() =>
                  writeContractAsync({
                    functionName: "setEpisodeContract",
                    args: [episode.id, newContract as `0x${string}`],
                  }),
                );
              }}
              disabled={isMining || newContract === episode.contractAddr}
            >
              Save contract
            </Button>
            <Button
              onClick={() => {
                if (!window.confirm(`Delete ${episode.name || "this episode"}?`)) return;
                void tx(() => writeContractAsync({ functionName: "deleteEpisode", args: [episode.id] }));
              }}
              disabled={isMining}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
};

// FormField sibling for Ethereum addresses. Uses scaffold-ui's AddressInput
// under the hood — ENS resolution, avatar, the blo identicon — wrapped in
// the same label treatment as FormField so the form layout stays consistent.
const AddressField = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) => (
  <label className="flex flex-col gap-1">
    <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
      {label}
    </span>
    <AddressInput value={value} onChange={onChange} placeholder={placeholder} />
  </label>
);

const FormField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "datetime-local";
  mono?: boolean;
}) => (
  <label className="flex flex-col gap-1">
    <span className="slop-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--slop-text-muted)" }}>
      {label}
    </span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="slop-textfield"
      style={mono ? { fontFamily: "var(--slop-font-mono)" } : undefined}
    />
  </label>
);

const KV = ({ k, v }: { k: string; v: string }) => (
  <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 slop-mono text-[11px]">
    <span style={{ color: "var(--slop-text-muted)" }}>{k}</span>
    <span className="break-all" style={{ color: "var(--slop-text)" }}>
      {v || "—"}
    </span>
  </div>
);

// Match the format expected by <input type="datetime-local"> in the user's
// local timezone — `Date#toISOString` would shift it to UTC.
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default AdminPage;
