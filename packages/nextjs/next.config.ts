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
  // /admin here is the *registry* admin (on-chain episode management for the
  // SlopComputer contract owner). The *broadcast* admin (RTMP keys, invites,
  // session config) still lives on live.slop.computer/admin — different
  // surface, different scope. /join still belongs over there.
  async redirects() {
    return [
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
