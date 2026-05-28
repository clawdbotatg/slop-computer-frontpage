"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import type { NextPage } from "next";
import { EpisodeView } from "~~/components/EpisodeView";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Thin route wrapper. The lookup + rendering live in EpisodeView so the
// static fallback (`app/not-found.tsx`, served as `ipfs-404.html`) can mount
// the exact same component for slugs that didn't exist at export time — a
// fresh episode is reachable on IPFS the moment it's registered on-chain,
// without redeploying the pin.
//
// `routeNotFound` throws Next's `notFound()` so the dynamic deploy returns
// a real 404 status for unregistered slugs. The static fallback can't set a
// status code anyway, so it passes inline 404 markup instead of this.
const RouteNotFound = (): never => notFound();

const EpisodePage: NextPage<PageProps> = ({ params }) => {
  const { slug } = use(params);
  return <EpisodeView slug={slug} notFound={<RouteNotFound />} />;
};

export default EpisodePage;
