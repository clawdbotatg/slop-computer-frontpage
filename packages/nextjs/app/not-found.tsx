"use client";

import { type ReactElement, useEffect, useState } from "react";
import Link from "next/link";
import { EpisodeView } from "~~/components/EpisodeView";

// Same regex the contract enforces for slug registration: `^[a-z0-9-]{1,64}$`.
// Keeping the gate strict means we don't accidentally try to render
// /favicon.ico, /admin (existing route), `/foo/bar` (multi-segment), etc.
const SLUG_RE = /^[a-z0-9-]{1,64}$/;

// `not-found.tsx` is the source for the exported `404.html` (which the IPFS
// build also copies to `ipfs-404.html` — kubo's gateway serves that for any
// unmatched path inside a UnixFS directory). That gives us a SPA-style
// fallback on the static pin: a deep-link to /<new-slug>/ that wasn't in the
// generateStaticParams enumeration still gets the app shell, and this
// component mounts EpisodeView — which already looks the slug up on-chain
// via wagmi — so the episode renders without a redeploy. If the slug isn't
// registered the contract reverts, EpisodeView renders <NotFoundCard/>, and
// we show the real 404.
//
// Why the mount gate: usePathname/window.location only have the real path on
// the client, but the static prerender bakes the path the file was built for
// (`/_not-found`). Returning <NotFoundCard/> on first paint keeps SSR and
// hydration identical, then the effect flips us to EpisodeView once we know
// the actual URL. Cheap and avoids the React hydration-mismatch warning.

const NotFoundCard = (): ReactElement => (
  <div className="flex items-center h-full flex-1 justify-center bg-base-200">
    <div className="text-center">
      <h1 className="text-6xl font-bold m-0 mb-1">404</h1>
      <h2 className="text-2xl font-semibold m-0">Page Not Found</h2>
      <p className="text-base-content/70 m-0 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary">
        Go Home
      </Link>
    </div>
  </div>
);

const parseSlugFromPath = (path: string): string | null => {
  // Strip leading/trailing slashes, then accept only a single segment.
  const seg = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!seg || seg.includes("/")) return null;
  if (!SLUG_RE.test(seg)) return null;
  return seg;
};

export default function NotFound(): ReactElement {
  const [slug, setSlug] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSlug(parseSlugFromPath(window.location.pathname));
  }, []);

  if (!mounted || !slug) return <NotFoundCard />;
  return <EpisodeView slug={slug} notFound={<NotFoundCard />} />;
}
