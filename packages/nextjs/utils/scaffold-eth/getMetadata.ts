import type { Metadata } from "next";

// Canonical production origin. We use this for the IPFS export because:
//   1. og:image et al. need *absolute* URLs per the OpenGraph spec, and
//      `http://localhost:3000/og.jpg` (the dev fallback) is obviously broken
//      on a static pin — any crawler that hit slopcomputer.eth.limo would
//      see a missing card image.
//   2. The IPFS deploy is intentionally a mirror; slop.computer (Vercel) is
//      the source of truth for fresh per-slug unfurl, so pointing absolute
//      assets at it means social shares of eth.limo URLs still resolve their
//      images and canonical against Vercel's edge.
const PRODUCTION_ORIGIN = "https://slop.computer";

const baseUrl =
  process.env.NEXT_PUBLIC_IPFS_BUILD === "true"
    ? PRODUCTION_ORIGIN
    : process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;
const titleTemplate = "%s | Scaffold-ETH 2";

export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/og.jpg",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
}): Metadata => {
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
    metadataBase: new URL(baseUrl),
    manifest: "/manifest.json",
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [
        {
          url: imageUrl,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: {
        default: title,
        template: titleTemplate,
      },
      description: description,
      images: [imageUrl],
    },
    icons: {
      icon: [
        {
          url: "/favicon.png",
          sizes: "32x32",
          type: "image/png",
        },
      ],
    },
  };
};
