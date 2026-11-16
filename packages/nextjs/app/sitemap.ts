import type { MetadataRoute } from "next";
import { getEpisodeIndexSafe } from "~~/utils/episodeIndex";
import { SITE_URL } from "~~/utils/site";

// /sitemap.xml — the home page, the about page, and every finalized episode
// page. Static for the IPFS export; ISR-refreshed on Vercel.
export const dynamic = "force-static";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { entries } = await getEpisodeIndexSafe();
  const episodes = entries.filter(e => e.manifest);
  const newest = episodes.reduce((t, e) => Math.max(t, e.datetime || 0), 0);
  return [
    {
      url: SITE_URL,
      lastModified: newest ? new Date(newest * 1000) : undefined,
      changeFrequency: "weekly",
      priority: 1,
    },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    ...episodes.map(e => ({
      url: `${SITE_URL}/${e.slug}`,
      lastModified: e.datetime ? new Date(e.datetime * 1000) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
