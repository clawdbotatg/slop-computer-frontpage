import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  eslint: {
    ignoreDuringBuilds: process.env.NEXT_PUBLIC_IGNORE_BUILD_ERROR === "true",
  },
  // /admin and /join used to live here. They moved to live.slop.computer
  // where the auth surface is — slop.computer is audience-only now.
  async redirects() {
    return [
      { source: "/admin", destination: "https://live.slop.computer/admin", permanent: false },
      { source: "/admin/:path*", destination: "https://live.slop.computer/admin/:path*", permanent: false },
      { source: "/join", destination: "https://live.slop.computer/", permanent: false },
      { source: "/join/:path*", destination: "https://live.slop.computer/", permanent: false },
    ];
  },
  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

const isIpfs = process.env.NEXT_PUBLIC_IPFS_BUILD === "true";

if (isIpfs) {
  nextConfig.output = "export";
  nextConfig.trailingSlash = true;
  nextConfig.images = {
    unoptimized: true,
  };
}

module.exports = nextConfig;
