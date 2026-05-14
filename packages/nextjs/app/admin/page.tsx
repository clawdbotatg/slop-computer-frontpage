"use client";

import { useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import { isAddress } from "viem";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { Button, LoadingBar } from "~~/components/ui";
import externalContracts from "~~/contracts/externalContracts";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";
import { type Episode, ZERO_ADDRESS, formatDate, isZeroEpisode, slugify } from "~~/types/episode";

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
    <div className="slop-mono text-[11px]" style={{ color: "var(--slop-text-muted)" }}>
      contract: {CONTRACT_ADDRESS} · ethereum mainnet
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
    query: READ_QUERY,
  });
  const { data: episodes, refetch: refetchEpisodes } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "getEpisodes",
    args: [0n, 100n],
    query: READ_QUERY,
  });
  const { data: episodeCount } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "episodeCount",
    query: READ_QUERY,
  });

  const refreshAll = () => {
    void refetchLive();
    void refetchEpisodes();
  };

  const liveId = liveEpisode && !isZeroEpisode(liveEpisode) ? liveEpisode.id : null;

  return (
    <div className="flex flex-col gap-10">
      <LiveStatusPanel liveEpisode={liveEpisode} onChange={refreshAll} />
      {liveEpisode && !isZeroEpisode(liveEpisode) ? (
        <FinalizePanel liveEpisode={liveEpisode} onUrlUpdated={refreshAll} />
      ) : null}
      <GoLiveForm onDone={refreshAll} />
      <AddEpisodeForm onDone={refreshAll} />
      <EpisodeTable
        episodes={episodes}
        liveId={liveId}
        totalCount={episodeCount !== undefined ? Number(episodeCount) : undefined}
        onChange={refreshAll}
      />
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

type FinalizeEvent =
  | { phase: "starting"; file: string; name: string; totalBytes: number }
  | { phase: "remuxing" }
  | { phase: "uploading"; bytes: number; totalBytes: number }
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

const FinalizePanel = ({ liveEpisode, onUrlUpdated }: { liveEpisode: Episode; onUrlUpdated: () => void }) => {
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [cid, setCid] = useState("");
  const [manifestCid, setManifestCid] = useState("");
  const [checking, setChecking] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [bytesPinned, setBytesPinned] = useState(0);
  const [pinTotal, setPinTotal] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState("starting…");
  const [error, setError] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "SlopComputer" });

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
      const res = await fetch(`${RELAY_HTTP_URL}/admin/finalize`, { method: "POST", credentials: "include" });
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
            setPhaseLabel("remuxing fmp4 → mp4…");
          } else if (ev.phase === "uploading") {
            setBytesPinned(ev.bytes);
            if (ev.totalBytes > 0) setPinTotal(ev.totalBytes);
            setPhaseLabel("pinning to IPFS");
          } else if (ev.phase === "pinning-manifest") {
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
      await writeContractAsync({ functionName: "setManifest", args: [liveEpisode.id, url] });
      onUrlUpdated();
    } catch (e) {
      setError((e as Error).message || "tx failed");
    }
  };

  // Percentage for the LoadingBar. Falls back to indeterminate (undefined)
  // until we know totalBytes — kubo starts emitting Bytes within milliseconds
  // so this is brief.
  const pct = pinTotal > 0 ? Math.min(100, (bytesPinned / pinTotal) * 100) : undefined;

  return (
    <Section label={"// finalize"} title="Pin recording → IPFS → update episode url">
      <p className="slop-mono text-sm" style={{ color: "var(--slop-text-muted)" }}>
        after the show ends, pull the latest MediaMTX recording, pin it to our self-hosted IPFS node, and swap the
        on-chain url from the HLS stream to {"ipfs://<cid>"}. host session cookie on {RELAY_HTTP_URL} is required.
      </p>

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
              disabled={isMining || !manifestCid || `ipfs://${manifestCid}` === liveEpisode.manifest}
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

      {error ? (
        <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
          {error}
        </div>
      ) : null}
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
        args: [name.trim(), slug, "", contractAddr as `0x${string}`, BigInt(unix)],
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
      <FormField label="contract" value={contractAddr} onChange={setContractAddr} placeholder={ZERO_ADDRESS} mono />
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
        args: [name.trim(), slug, manifest.trim(), contractAddr as `0x${string}`, BigInt(unix)],
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
      <FormField label="contract" value={contractAddr} onChange={setContractAddr} placeholder={ZERO_ADDRESS} mono />
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
          <FormField label="contract" value={newContract} onChange={setNewContract} mono />
          {error ? (
            <div className="slop-mono text-[11px]" style={{ color: "var(--slop-accent)" }}>
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {!isLive ? (
              <Button
                onClick={() => tx(() => writeContractAsync({ functionName: "setLive", args: [episode.id] }))}
                disabled={isMining}
              >
                Set live
              </Button>
            ) : null}
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
