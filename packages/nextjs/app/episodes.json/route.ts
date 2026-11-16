import { getEpisodeIndex } from "~~/utils/episodeIndex";

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

export async function GET() {
  const { count, entries, liveEntry, contract } = await getEpisodeIndex();

  return Response.json(
    {
      generatedAt: new Date().toISOString(),
      source: {
        contract,
        chainId: 1,
        abi: "https://slop.computer/abi.json",
        gateway: "https://media.slop.computer/ipfs",
        docs: "https://slop.computer/skill.md",
      },
      count,
      live: liveEntry
        ? { id: liveEntry.id, slug: liveEntry.slug, hls: "https://media.slop.computer/hls/live/index.m3u8" }
        : null,
      episodes: entries,
    },
    { headers: { "access-control-allow-origin": "*" } },
  );
}
