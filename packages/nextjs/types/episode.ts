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
  /** `live.slop.computer/<liveSlug>` — the relay room this episode streams from.
   *  Empty means "same as `slug`"; readers should resolve via {@link relaySlug}. */
  readonly liveSlug: string;
  /** `ipfs://<cid>` to the manifest JSON. Empty during live (no manifest yet). */
  readonly manifest: string;
  readonly contractAddr: string;
  readonly datetime: bigint;
  readonly addedAt: bigint;
  readonly nextId: `0x${string}`;
};

/**
 * Chain the SlopComputer contract lives on (Ethereum mainnet). EVERY
 * `useScaffoldReadContract({ contractName: "SlopComputer", … })` MUST pass
 * `chainId: SLOP_CHAIN_ID`.
 *
 * Why: scaffold-eth's `useTargetNetwork` follows the connected wallet's chain
 * whenever it's one of `scaffold.config.targetNetworks` — and we keep `base`
 * + `gnosis` in that list so `/tip`'s `switchChain` works. Without an explicit
 * chainId, a visitor whose wallet is on Base (e.g. right after tipping) would
 * resolve SlopComputer's address on Base, where it isn't deployed, and every
 * episode read would hang forever on "loading…". Pinning the read to mainnet
 * decouples episode data from whatever chain the wallet is roaming on.
 */
export const SLOP_CHAIN_ID = 1 as const;

/** The slug used for relay calls (card URL, /v1/chat?slug=, /v1/transcript?slug=).
 *  Falls back to `episode.slug` when `liveSlug` is empty — the common case. */
export const relaySlug = (episode: Pick<Episode, "slug" | "liveSlug">): string => episode.liveSlug || episode.slug;

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
  /**
   * Seconds into the VOD where playback should auto-start on first load, so
   * viewers skip the pre-episode countdown. Set to the literal seek position
   * (e.g. 155 = 00:02:35) — the player jumps straight there, no math. Convention
   * is to leave ~5s of countdown visible, so set it a few seconds before the
   * countdown actually hits zero. Human-authored via the admin panel (not the
   * AI pass). Omitted/0 → play from the start.
   */
  startSeconds?: number;
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
   * Time-series of window geometry over the episode (geometry.jsonl on IPFS).
   * The relay logs every shared-desktop window's exact rect during the session
   * so downstream tools (the clipper's 9:16 mobile crop) can read window
   * positions deterministically instead of recovering them from the recorded
   * pixels. Purely carried through here — the frontpage doesn't render it yet.
   */
  geometry?: { cid: string; format?: string; sampleCount?: number };
  /**
   * Host-baked unfurl card PNG pinned to IPFS during finalize. Lets the per-
   * episode preview image survive the relay box going away. Renderers should
   * prefer this over the centralized `live.slop.computer/v1/cards/<slug>/published.png`
   * URL whenever it's set. `previewCid` is the small tier (768-wide JPEG,
   * ~100 KB) baked for list/grid renders — prefer it over the full `cid`
   * anywhere the card isn't shown near full size.
   */
  card?: { cid: string; format?: string; sizeBytes?: number; previewCid?: string; previewSizeBytes?: number };
  /**
   * AI-generated vertical (9:16) clips + suggested tweet copy, pinned to bgipfs
   * as clips.json (see clawd-clipper `--publish`). Carried in the manifest; the
   * episode page renders an ADMIN-ONLY Clips section from it — public viewers
   * don't see it (curation/review, not a secret: the bundle is public IPFS).
   */
  clips?: { cid: string; count?: number; format?: string };
  meta?: EpisodeMeta;
  /**
   * Long-running participant roster captured by the relay every time a peer
   * joined the desktop mesh — first-seen wins, dedup by address (for SIWE/
   * passkey peers) or by anonId (for anon peers). For anon entries `address`
   * is null and the chosen display name is already resolved into `handle`.
   * `ens` is kept as a legacy alias and either is picked up by the renderer.
   */
  participants?: {
    address: string | null;
    anonId?: string | null;
    role?: string;
    handle?: string | null;
    ens?: string;
  }[];
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
 * Pass `download` to make kubo emit `Content-Disposition: attachment` so the
 * browser saves the file instead of playing it in-tab.
 */
export const gatewayUrl = (ipfsUrl: string, filename?: string, download?: boolean): string => {
  if (!isIpfsUrl(ipfsUrl)) return ipfsUrl;
  const cid = ipfsUrl.slice(IPFS_PREFIX.length);
  if (!filename) return `${IPFS_GATEWAY}/${cid}`;
  const dl = download ? "&download=true" : "";
  return `${IPFS_GATEWAY}/${cid}?filename=${encodeURIComponent(filename)}${dl}`;
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

// The show runs out of Mountain Time, so we render every scheduled start in
// that zone and label it "MT" — every viewer reads the same wall-clock start
// regardless of their own locale, rather than a time silently shifted into it.
export const SHOW_TZ = "America/Denver";

/**
 * Full "Tue, Jun 3, 10:00 AM MT" stamp from a unix-seconds bigint. Pinned to
 * {@link SHOW_TZ} and suffixed "MT". Drops the year unless it differs from the
 * current year (compared in the same zone so a late-night slot doesn't flip it).
 * `0n` → `"—"`, matching {@link formatDate}.
 */
export const formatDateTimeMT = (datetime: bigint): string => {
  if (datetime === 0n) return "—";
  const d = new Date(Number(datetime) * 1000);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: SHOW_TZ,
  };
  const yearIn = (when: Date) => new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: SHOW_TZ }).format(when);
  if (yearIn(d) !== yearIn(new Date())) opts.year = "numeric";
  return `${new Intl.DateTimeFormat("en-US", opts).format(d)} MT`;
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
