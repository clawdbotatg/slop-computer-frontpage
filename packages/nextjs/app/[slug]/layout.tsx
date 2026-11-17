import { cache } from "react";
import type { Metadata } from "next";
import externalContracts from "~~/contracts/externalContracts";
import { fetchManifest, gatewayUrl, relaySlug } from "~~/types/episode";
import { mainnetClient } from "~~/utils/episodeIndex";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";
import { SITE_URL } from "~~/utils/site";

// Per-slug unfurl metadata. The page.tsx for this route is "use client" (it
// relies on wagmi hooks for the on-chain episode lookup) so it can't export
// generateMetadata itself — adding a server-component layout.tsx is the
// standard escape hatch for "client page, dynamic metadata" in App Router.
//
// Resolution order for og:image / twitter:image:
//   1. If the episode is FINALIZED (contract.manifest is set and the manifest
//      JSON has card.cid), use the IPFS-pinned card. This decouples the
//      unfurl from the live relay forever — the host can reuse the same
//      slug for a future live show and the old episode's social preview
//      keeps pointing at its immutable IPFS card.
//   2. Otherwise (pre-finalize / live), fall back to the live relay's
//      `/v1/cards/<slug>/published.png` so freshly-published cards still
//      show up before the episode is sealed on-chain.
//   3. On any failure (slug not registered, RPC error, manifest 404), fall
//      back to the live relay URL — harmless: Twitter just renders the
//      default thumbnail until the host publishes a card.

const SLOP = externalContracts[1].SlopComputer;
const FALLBACK_CARD_BASE = "https://live.slop.computer/v1/cards";

// Cards are always baked at a fixed 1536x1024 (see relay `card.ts` SIZE) —
// both the IPFS-pinned manifest card and the live relay's published.png.
// Declaring the dimensions lets crawlers lay the card out without first
// fetching the image, so unfurls resolve on the very first crawl.
const CARD_WIDTH = 1536;
const CARD_HEIGHT = 1024;

const publicClient = mainnetClient();

const fallbackCardUrl = (slug: string) => `${FALLBACK_CARD_BASE}/${encodeURIComponent(slug)}/published.png`;

type ResolvedMeta = {
  title: string;
  description: string;
  cardUrl: string;
  /** Set only for finalized episodes — drives the PodcastEpisode JSON-LD. */
  episode?: { name: string; datetime: number; durationSeconds?: number; topics: string[]; transcriptCid?: string };
};

// cache(): generateMetadata and the layout both resolve the same slug per
// request — one chain read + manifest fetch, not two.
const resolveEpisodeMeta = cache(async (slug: string): Promise<ResolvedMeta> => {
  const defaultMeta: ResolvedMeta = {
    title: `${slug} — slop.computer`,
    description: `Episode ${slug} on slop.computer — onchain podcast pinned to IPFS.`,
    cardUrl: fallbackCardUrl(slug),
  };

  try {
    const episode = (await publicClient.readContract({
      address: SLOP.address as `0x${string}`,
      abi: SLOP.abi,
      functionName: "getEpisodeBySlug",
      args: [slug],
    })) as {
      id: `0x${string}`;
      name: string;
      slug: string;
      liveSlug: string;
      manifest: string;
      datetime: bigint;
    };

    const name = episode.name || slug;
    const liveCard = fallbackCardUrl(relaySlug(episode));

    if (!episode.manifest) {
      // Scheduled or live — no manifest yet. Card is whatever the relay has.
      return {
        title: `${name} — slop.computer`,
        description: `Episode ${slug} on slop.computer — onchain podcast pinned to IPFS.`,
        cardUrl: liveCard,
      };
    }

    const manifest = await fetchManifest(episode.manifest);
    const description = manifest?.meta?.oneLiner || manifest?.meta?.description || manifest?.description;
    const title = manifest?.meta?.title || name;
    return {
      title: `${title} — slop.computer podcast`,
      episode: {
        name: title,
        datetime: Number(episode.datetime ?? 0n),
        durationSeconds: manifest?.video?.durationSeconds,
        topics: manifest?.meta?.topics ?? [],
        transcriptCid: manifest?.transcript?.cid,
      },
      description: description || `Episode ${slug} on slop.computer — onchain podcast pinned to IPFS.`,
      cardUrl: manifest?.card?.cid ? gatewayUrl(`ipfs://${manifest.card.cid}`) : liveCard,
    };
  } catch {
    return defaultMeta;
  }
});

// Static export (`yarn ipfs`, NEXT_PUBLIC_IPFS_BUILD=true → output: "export")
// has no server at request time, so every dynamic route must enumerate its
// params at build time. We read the full episode list off-chain and emit one
// path per registered slug. The page body itself is "use client" and refetches
// live, so a pre-rendered slug still shows fresh data once hydrated — only the
// *set of slug paths* (and their unfurl metadata) is frozen at export time.
// Anything else (a brand-new episode, an episode the contract owner registered
// after the export) is served via the SPA fallback wired up in
// `app/not-found.tsx` + `out/_redirects`, which the gateway hits whenever a
// path isn't pre-rendered.
//
// Next 15 with `output: "export"` rejects an empty `generateStaticParams`
// return ("missing generateStaticParams") — so when the contract has zero
// episodes (fresh deploy / RPC failure) we emit a single synthetic slug
// `__placeholder__`. The double underscores guarantee it never collides
// with a real registered slug because the contract's slug regex is
// `^[a-z0-9-]{1,64}$` (no underscores allowed). The page just renders the
// usual lookup → revert → 404 path, exactly like any other unregistered slug.
const PLACEHOLDER_SLUG = "__placeholder__";

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const fallback = [{ slug: PLACEHOLDER_SLUG }];
  try {
    const count = (await publicClient.readContract({
      address: SLOP.address as `0x${string}`,
      abi: SLOP.abi,
      functionName: "episodeCount",
    })) as bigint;
    if (!count) return fallback;
    const episodes = (await publicClient.readContract({
      address: SLOP.address as `0x${string}`,
      abi: SLOP.abi,
      functionName: "getEpisodes",
      args: [0n, count],
    })) as readonly { slug: string }[];
    const real = episodes.map(e => ({ slug: e.slug })).filter(p => Boolean(p.slug));
    return real.length > 0 ? real : fallback;
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { title, description, cardUrl } = await resolveEpisodeMeta(slug);
  const meta = getMetadata({ title, description });
  const image = { url: cardUrl, width: CARD_WIDTH, height: CARD_HEIGHT };
  return {
    ...meta,
    alternates: { canonical: `${SITE_URL}/${slug}` },
    // `url` is relative — Next resolves it against metadataBase
    // (https://slop.computer) so og:url is the canonical per-slug page.
    openGraph: { ...(meta.openGraph ?? {}), url: `/${slug}`, images: [image] },
    twitter: { ...(meta.twitter ?? {}), images: [image] },
  };
}

type Turn = { speaker: string; text: string };

/** Transcript JSONL (from IPFS, immutable by CID) → speaker turns. Speech
 *  events have no `kind`; consecutive lines from one speaker merge into one
 *  paragraph. Same filter as scripts/fetch-transcripts.mjs. */
const fetchTranscript = async (cid: string): Promise<Turn[]> => {
  try {
    const res = await fetch(gatewayUrl(`ipfs://${cid}`), { cache: "force-cache" });
    if (!res.ok) return [];
    const turns: Turn[] = [];
    for (const raw of (await res.text()).split("\n")) {
      let d: { kind?: string; text?: string; handle?: string; anonId?: string; address?: string };
      try {
        d = JSON.parse(raw);
      } catch {
        continue;
      }
      const text = d.text?.trim();
      // Skip screen events and the STT prompt that sometimes leaks in as speech.
      if (d.kind || !text || text === "context:" || text.startsWith("The following is a transcript of")) continue;
      const speaker = d.handle || d.anonId || d.address || "?";
      const last = turns.at(-1);
      if (last?.speaker === speaker) last.text += ` ${text}`;
      else turns.push({ speaker, text });
    }
    return turns;
  } catch {
    return [];
  }
};

// Full transcript, server-rendered under the (client-side) episode view, so
// every episode is searchable by what was actually said. Collapsed by default.
const Transcript = ({ title, turns }: { title: string; turns: Turn[] }) => (
  <section className="w-full max-w-6xl mx-auto px-4 pb-12">
    <details style={{ borderTop: "1px dashed rgba(255, 62, 201, 0.25)", paddingTop: 24 }}>
      <summary
        className="slop-mono text-sm sm:text-base cursor-pointer"
        style={{ color: "var(--slop-magenta)", textTransform: "none" }}
      >
        {`// full transcript — ${title}`}
      </summary>
      <div className="flex flex-col gap-3 mt-4 slop-mono text-sm" style={{ textTransform: "none" }}>
        {turns.map((t, i) => (
          <p key={i} className="m-0" style={{ color: "var(--slop-text)" }}>
            <span style={{ color: "var(--slop-cyan)" }}>{t.speaker}:</span> {t.text}
          </p>
        ))}
      </div>
    </details>
  </section>
);

// PodcastEpisode structured data + transcript. The visible episode body
// renders client-side from chain reads, so this is what crawlers get without
// running JS.
export default async function SlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { description, cardUrl, episode } = await resolveEpisodeMeta(slug);
  if (!episode) return children;
  const turns = episode.transcriptCid ? await fetchTranscript(episode.transcriptCid) : [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    name: episode.name,
    url: `${SITE_URL}/${slug}`,
    description,
    image: cardUrl,
    ...(episode.datetime ? { datePublished: new Date(episode.datetime * 1000).toISOString().slice(0, 10) } : {}),
    ...(episode.durationSeconds ? { timeRequired: `PT${Math.round(episode.durationSeconds / 60)}M` } : {}),
    ...(episode.topics.length ? { keywords: episode.topics.join(", ") } : {}),
    partOfSeries: { "@type": "PodcastSeries", name: "slop.computer", url: "https://slop.computer" },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
      {turns.length > 0 ? <Transcript title={episode.name} turns={turns} /> : null}
    </>
  );
}
