import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";
import externalContracts from "~~/contracts/externalContracts";
import { Episode, EpisodeManifest, ZERO_BYTES32, fetchManifest, gatewayUrl, relaySlug } from "~~/types/episode";

/**
 * GET /episodes.json — the aggregate machine-readable episode index.
 *
 * One fetch answers what otherwise takes an onchain `getEpisodes` read plus a
 * manifest fetch per episode: how many episodes exist, what each is about
 * (AI title/one-liner/description/topics/chapters), who was on, and the IPFS
 * CIDs for video/transcript/chat. This is the primary path skill.md points
 * agents at; the contract stays the canonical, trustless source.
 *
 * `force-static` so the IPFS export (`yarn ipfs`) bakes a build-time snapshot,
 * while Vercel re-generates it via ISR every `revalidate` seconds.
 */
export const dynamic = "force-static";
export const revalidate = 300;

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

const toEntry = (ep: Episode, manifest: EpisodeManifest | null, liveId: string) => {
  const m = manifest ?? {};
  const slug = ep.slug;
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
    durationSeconds: m.video?.durationSeconds,
    media: {
      video: m.video ? { ...m.video, url: assetUrl(m.video, `${slug}.mp4`) } : undefined,
      transcript: m.transcript ? { ...m.transcript, url: assetUrl(m.transcript) } : undefined,
      chat: m.chat ? { ...m.chat, url: assetUrl(m.chat) } : undefined,
      card: m.card ? { ...m.card, url: assetUrl(m.card, `${slug}.png`) } : undefined,
    },
  };
};

export async function GET() {
  const client = createPublicClient({
    chain: mainnet,
    transport: fallback(RPCS.map(u => http(u))),
  });

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

  const manifests = await Promise.all(episodes.map(ep => fetchManifest(ep.manifest)));
  const entries = episodes.map((ep, i) => toEntry(ep, manifests[i], liveId));
  const liveEntry = liveId !== ZERO_BYTES32 ? entries.find(e => e.id === liveId) : undefined;

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      source: {
        contract: CONTRACT,
        chainId: 1,
        abi: "https://slop.computer/abi.json",
        gateway: "https://media.slop.computer/ipfs",
        docs: "https://slop.computer/skill.md",
      },
      count: Number(count),
      live: liveEntry ? { id: liveEntry.id, slug: liveEntry.slug, hls: "https://media.slop.computer/hls/live/index.m3u8" } : null,
      episodes: entries,
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
