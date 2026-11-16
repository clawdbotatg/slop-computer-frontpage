import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import externalContracts from "~~/contracts/externalContracts";
import { Episode, EpisodeManifest, ZERO_BYTES32, fetchManifest, gatewayUrl, relaySlug } from "~~/types/episode";

/**
 * Server-side episode index: one chain read + one manifest fetch per episode.
 * Shared by /episodes.json, /sitemap.xml, and the server-rendered parts of
 * the home page (episode index + JSON-LD) so crawlers see real episode text
 * instead of the client-side "loading…" shell.
 */
const RPCS = [
  process.env.ETH_RPC_URL,
  "https://ethereum-rpc.publicnode.com",
  "https://cloudflare-eth.com",
  "https://eth.llamarpc.com",
].filter((u): u is string => !!u);

const { address: CONTRACT, abi } = externalContracts[1].SlopComputer;

/** Gateway URL for an optional manifest asset, with inline-playback filename. */
const assetUrl = (asset: { cid: string } | undefined, filename?: string) =>
  asset?.cid ? gatewayUrl(`ipfs://${asset.cid}`, filename) : undefined;

const RELAY = process.env.NEXT_PUBLIC_RELAY_HTTP_URL ?? "https://live.slop.computer";
type TldrRow = { text: string; url: string; updatedTs: number };

/** Host TLDR tweets from the relay (live source, no tx). Empty on failure —
 *  entries then fall back to whatever the manifest carries. */
const fetchTldrs = async (): Promise<Record<string, TldrRow>> => {
  try {
    const res = await fetch(`${RELAY}/v1/episodes/tldr`, { next: { revalidate: 300 } });
    if (!res.ok) return {};
    const j = (await res.json()) as { items?: Record<string, TldrRow> };
    return j.items ?? {};
  } catch {
    return {};
  }
};

export const toEntry = (
  ep: Episode,
  manifest: EpisodeManifest | null,
  liveId: string,
  tldrs: Record<string, TldrRow>,
) => {
  const m = manifest ?? {};
  const slug = ep.slug;
  const t = tldrs[slug.toLowerCase()] ?? m.meta?.tldr;
  const tldr = t?.text ? { text: t.text, url: t.url || undefined, updatedTs: t.updatedTs } : undefined;
  return {
    id: ep.id,
    slug,
    name: ep.name,
    title: m.meta?.title || ep.name,
    oneLiner: m.meta?.oneLiner,
    description: m.meta?.description || m.description,
    topics: m.meta?.topics ?? [],
    tags: m.tags ?? [],
    chapters: m.meta?.chapters ?? [],
    participants: m.participants ?? [],
    datetime: Number(ep.datetime),
    addedAt: Number(ep.addedAt),
    live: ep.id === liveId,
    page: `https://slop.computer/${slug}`,
    liveRoom: `https://live.slop.computer/${relaySlug(ep)}`,
    tipContract: ep.contractAddr,
    manifest: ep.manifest || undefined,
    manifestUrl: ep.manifest ? gatewayUrl(ep.manifest) : undefined,
    tldr,
    durationSeconds: m.video?.durationSeconds,
    media: {
      video: m.video ? { ...m.video, url: assetUrl(m.video, `${slug}.mp4`) } : undefined,
      transcript: m.transcript ? { ...m.transcript, url: assetUrl(m.transcript) } : undefined,
      chat: m.chat ? { ...m.chat, url: assetUrl(m.chat) } : undefined,
      card: m.card ? { ...m.card, url: assetUrl(m.card, `${slug}.png`) } : undefined,
    },
  };
};

export type EpisodeEntry = ReturnType<typeof toEntry>;

/** Mainnet client over the RPC fallback list — the bare default public RPC
 *  rate-limits a build that prerenders every episode page. */
export const mainnetClient = () => createPublicClient({ chain: mainnet, transport: fallback(RPCS.map(u => http(u))) });

export async function getEpisodeIndex() {
  const client = mainnetClient();

  const count = (await client.readContract({ address: CONTRACT, abi, functionName: "episodeCount" })) as bigint;
  const [episodes, liveId] = await Promise.all([
    count > 0n
      ? (client.readContract({
          address: CONTRACT,
          abi,
          functionName: "getEpisodes",
          args: [0n, count],
        }) as Promise<readonly Episode[]>)
      : Promise.resolve([] as Episode[]),
    client.readContract({ address: CONTRACT, abi, functionName: "live" }) as Promise<string>,
  ]);

  const [manifests, tldrs] = await Promise.all([
    Promise.all(episodes.map(ep => fetchManifest(ep.manifest))),
    fetchTldrs(),
  ]);
  const entries = episodes.map((ep, i) => toEntry(ep, manifests[i], liveId, tldrs));
  const liveEntry = liveId !== ZERO_BYTES32 ? entries.find(e => e.id === liveId) : undefined;
  return { count: Number(count), entries, liveEntry, contract: CONTRACT };
}

/** Never throws — pages and the sitemap degrade to "no episodes" on RPC failure. */
export async function getEpisodeIndexSafe() {
  try {
    return await getEpisodeIndex();
  } catch {
    return { count: 0, entries: [] as EpisodeEntry[], liveEntry: undefined, contract: CONTRACT };
  }
}
