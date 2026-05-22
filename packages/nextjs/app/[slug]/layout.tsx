import type { Metadata } from "next";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

// Per-slug unfurl metadata. The page.tsx for this route is "use client"
// (it relies on wagmi hooks for the on-chain episode lookup) so it
// can't export generateMetadata itself — adding a server-component
// layout.tsx is the standard escape hatch for "client page, dynamic
// metadata" in Next.js App Router.
//
// We OPTIMISTICALLY point og:image at the live-relay's per-room card
// without checking whether the file exists. If a host has published
// the card for that slug (via the disk button in CardWindow on
// live.slop.computer/<slug>), Twitter/Discord/iMessage will render it.
// If not, the link preview falls back to the default thumbnail —
// nothing breaks, the host just hasn't published a unique card yet.
//
// Why no HEAD check: the frontpage is on Vercel and we'd rather not
// add a relay round-trip into every cold-render of /<slug>. The card
// URL is stable forever for any given slug; advertising it before
// it exists is harmless.
const CARD_URL_BASE = "https://live.slop.computer/v1/cards";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cardUrl = `${CARD_URL_BASE}/${encodeURIComponent(slug)}/published.png`;
  const meta = getMetadata({
    title: `${slug} — slop.computer`,
    description: `Episode ${slug} on slop.computer — onchain podcast pinned to IPFS.`,
  });
  return {
    ...meta,
    openGraph: { ...(meta.openGraph ?? {}), images: [{ url: cardUrl }] },
    twitter: { ...(meta.twitter ?? {}), images: [cardUrl] },
  };
}

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
