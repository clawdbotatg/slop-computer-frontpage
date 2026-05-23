/**
 * Shape returned by SlopComputer (`getEpisodes`, `getEpisode`, `getEpisodeBySlug`,
 * `latest`, `liveEpisode`). `contractAddr` is widened to `string` because
 * scaffold-eth's `GenericContract.abi: Abi` upcast loses abitype's address
 * narrowing.
 *
 * Per the v2 contract, almost everything beyond name/slug/datetime lives in the
 * off-chain manifest JSON addressed by `manifest` (an `ipfs://<cid>` string).
 * See docs in the .sol for the manifest schema.
 */
export type Episode = {
  readonly id: `0x${string}`;
  readonly name: string;
  readonly slug: string;
  /** `ipfs://<cid>` to the manifest JSON. Empty during live (no manifest yet). */
  readonly manifest: string;
  readonly contractAddr: string;
  readonly datetime: bigint;
  readonly nextId: `0x${string}`;
};

/**
 * AI-generated episode metadata. The relay's finalize flow runs a pass over
 * the transcript + chat and writes the result under `manifest.meta` (kept
 * namespaced — and tagged with `generatedBy`/`generatedAt` — so AI output
 * stays distinguishable from human-authored fields).
 */
export type EpisodeMeta = {
  title?: string;
  oneLiner?: string;
  description?: string;
  topics?: string[];
  chapters?: { tStart: number; title: string }[];
  generatedBy?: string;
  generatedAt?: number;
};

/** Best-effort schema for the manifest JSON the contract's `manifest` points at. */
export type EpisodeManifest = {
  version?: number;
  /** Legacy / human-authored top-level description. Prefer `meta.description`. */
  description?: string;
  video?: { cid: string; durationSeconds?: number; sizeBytes?: number; format?: string };
  transcript?: { cid: string; format?: string; language?: string; segmentCount?: number };
  chat?: { cid: string; messageCount?: number };
  /**
   * Host-baked unfurl card PNG pinned to IPFS during finalize. Lets the per-
   * episode preview image survive the relay box going away. Renderers should
   * prefer this over the centralized `live.slop.computer/v1/cards/<slug>/published.png`
   * URL whenever it's set.
   */
  card?: { cid: string; format?: string; sizeBytes?: number };
  meta?: EpisodeMeta;
  /**
   * Long-running participant roster captured by the relay every time a peer
   * joined the desktop mesh — first-seen wins, dedup by address. The relay
   * emits `handle` (custom display name set in the room); `ens` is kept as a
   * legacy alias and either is picked up by the renderer.
   */
  participants?: { address: string; role?: string; handle?: string | null; ens?: string }[];
  files?: { name: string; cid: string; sizeBytes?: number }[];
  links?: { label: string; url: string }[];
  tags?: string[];
};

export const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Self-hosted kubo gateway behind Caddy. Overridable for local dev or if we ever
// federate to a different gateway. `?filename=…` makes kubo emit
// Content-Disposition: inline so browsers play media in-tab instead of saving.
const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
  process.env.NEXT_PUBLIC_BGIPFS_GATEWAY || // legacy name, still honored
  "https://media.slop.computer/ipfs";
const IPFS_PREFIX = "ipfs://";

export const isIpfsUrl = (url: string) => url.startsWith(IPFS_PREFIX);

/**
 * Resolve an `ipfs://CID` to an HTTP gateway URL. Pass `filename` for inline
 * playback (mp4 etc.); omit for JSON/text fetches like the manifest itself.
 */
export const gatewayUrl = (ipfsUrl: string, filename?: string): string => {
  if (!isIpfsUrl(ipfsUrl)) return ipfsUrl;
  const cid = ipfsUrl.slice(IPFS_PREFIX.length);
  return filename ? `${IPFS_GATEWAY}/${cid}?filename=${encodeURIComponent(filename)}` : `${IPFS_GATEWAY}/${cid}`;
};

/** Fetch the manifest JSON at `episode.manifest`. Returns null on any failure. */
export const fetchManifest = async (ipfsUrl: string): Promise<EpisodeManifest | null> => {
  if (!ipfsUrl || !isIpfsUrl(ipfsUrl)) return null;
  try {
    const res = await fetch(gatewayUrl(ipfsUrl));
    if (!res.ok) return null;
    return (await res.json()) as EpisodeManifest;
  } catch {
    return null;
  }
};

/** YYYY-MM-DD from a unix-seconds bigint, or `"—"` for the zero-struct case. */
export const formatDate = (datetime: bigint) => {
  if (datetime === 0n) return "—";
  return new Date(Number(datetime) * 1000).toISOString().slice(0, 10);
};

export const isZeroEpisode = (ep: Episode | undefined) => !ep || ep.id === ZERO_BYTES32;

/**
 * Best-effort slug from a free-form episode name: lowercase, ASCII-only,
 * runs of non-alphanum collapse to a single `-`, leading/trailing dashes
 * stripped, capped at 64 chars. Matches the contract's `^[a-z0-9-]{1,64}$`
 * rule for the common case; user can always override in the form.
 */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
