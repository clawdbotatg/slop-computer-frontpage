import Home from "./HomeClient";
import { type EpisodeEntry, getEpisodeIndexSafe } from "~~/utils/episodeIndex";
import { SITE_URL } from "~~/utils/site";

// Server shell around the client home page. The episode cards render from
// live chain reads in the browser, so without this the HTML a crawler gets is
// just the hero. Here we read the same index /episodes.json serves and put it
// in the initial HTML twice: a visible episode index (titles + one-liners,
// linking every episode page) and PodcastSeries JSON-LD.
export const revalidate = 300;

export const metadata = { alternates: { canonical: SITE_URL } };

const MAGENTA_DASH = "1px dashed rgba(255, 62, 201, 0.25)";

const seriesJsonLd = (entries: EpisodeEntry[]) => ({
  "@context": "https://schema.org",
  "@type": "PodcastSeries",
  name: "slop.computer",
  alternateName: "slop.computer — AI × crypto podcast",
  url: SITE_URL,
  description:
    "An onchain podcast about AI and crypto: AI agents, Ethereum, smart contracts, and building software with Claude Code and Codex. Interviews with the builders working where AI meets crypto.",
  image: `${SITE_URL}/podcast-cover.png`,
  inLanguage: "en",
  webFeed: `${SITE_URL}/feed.xml`,
  genre: ["Technology", "Artificial Intelligence", "Cryptocurrency", "Ethereum"],
  keywords: "AI podcast, crypto podcast, AI and crypto, AI agents, Ethereum, onchain, web3, Claude Code, vibe coding",
  author: { "@type": "Person", name: "Austin Griffith" },
  sameAs: [
    "https://open.spotify.com/show/4IA364aVPvjh3SWTT9rToS",
    "https://podcasts.apple.com/us/podcast/slop-computer/id6810863494",
  ],
  episode: entries
    .filter(e => e.manifest)
    .map(e => ({
      "@type": "PodcastEpisode",
      name: e.title,
      url: e.page,
      description: e.oneLiner || e.description,
      datePublished: e.datetime ? new Date(e.datetime * 1000).toISOString().slice(0, 10) : undefined,
      ...(e.durationSeconds ? { timeRequired: `PT${Math.round(e.durationSeconds / 60)}M` } : {}),
    })),
});

const EpisodeIndex = ({ entries }: { entries: EpisodeEntry[] }) => {
  const done = entries.filter(e => e.manifest); // already newest-first
  if (done.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" style={{ borderTop: MAGENTA_DASH, paddingTop: 32 }}>
      <details>
        <summary
          className="slop-mono text-sm sm:text-base cursor-pointer"
          style={{ color: "var(--slop-magenta)", textTransform: "none" }}
        >
          {`// episode index — all ${done.length} episodes`}
        </summary>
        <ol className="flex flex-col gap-3 mt-4 slop-mono text-sm" style={{ textTransform: "none" }}>
          {done.map(e => (
            <li key={e.id}>
              <a href={`/${e.slug}`} className="slop-link" style={{ color: "var(--slop-text)" }}>
                {e.title}
              </a>
              {e.oneLiner ? <span style={{ color: "var(--slop-text-muted)" }}>{` — ${e.oneLiner}`}</span> : null}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
};

export default async function Page() {
  const { entries } = await getEpisodeIndexSafe();
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify can't emit "</script>" safely; escape "<" so a
        // manifest string can never close the tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seriesJsonLd(entries)).replace(/</g, "\\u003c") }}
      />
      <Home archive={<EpisodeIndex entries={entries} />} />
    </>
  );
}
