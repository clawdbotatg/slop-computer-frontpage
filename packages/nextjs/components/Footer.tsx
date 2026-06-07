"use client";

import React from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { Address as AddressType } from "viem";
import externalContracts from "~~/contracts/externalContracts";

const contractAddress = externalContracts[1].SlopComputer.address as AddressType;

// Tiny glowing-green Ethereum diamond — matches the neon wireframe octahedron
// drawn in the slop-computer-background tunnel (faces rgba(188,255,91), edges
// rgba(210,255,140), green glow). Sits next to the eth.limo link.
const EthLogo = ({ size = 15 }: { size?: number }) => (
  <svg
    width={(size * 256) / 417}
    height={size}
    viewBox="0 0 256 417"
    aria-hidden="true"
    style={{ filter: "drop-shadow(0 0 2.5px rgba(188,255,91,0.75))", flexShrink: 0 }}
  >
    {/* faceted faces — left halves a touch brighter for depth */}
    <path d="M127.96 0 L0 212.32 L127.96 287.96 Z" fill="rgba(188,255,91,0.32)" />
    <path d="M127.96 0 L255.92 212.32 L127.96 287.96 Z" fill="rgba(188,255,91,0.16)" />
    <path d="M127.96 312.19 L0 236.59 L127.96 416.9 Z" fill="rgba(188,255,91,0.32)" />
    <path d="M127.96 312.19 L255.92 236.59 L127.96 416.9 Z" fill="rgba(188,255,91,0.16)" />
    {/* glowing edges */}
    <g stroke="rgba(210,255,140,0.95)" strokeWidth="9" strokeLinejoin="round" fill="none">
      <path d="M127.96 0 L0 212.32 L127.96 287.96 L255.92 212.32 Z" />
      <path d="M127.96 312.19 L0 236.59 L127.96 416.9 L255.92 236.59 Z" />
      <path d="M127.96 0 L127.96 287.96 M127.96 312.19 L127.96 416.9" />
    </g>
  </svg>
);

// The whole project is open source (MIT). Order mirrors the stack: the page
// you're on, the chain it reads, the relay it streams from, the multisig that
// owns it, and the background worker.
const REPOS: { label: string; href: string }[] = [
  { label: "frontend", href: "https://github.com/clawdbotatg/slop-computer-frontpage" },
  { label: "contracts", href: "https://github.com/clawdbotatg/slop-computer-contracts" },
  { label: "live", href: "https://github.com/clawdbotatg/slop-computer-live" },
  { label: "multisig", href: "https://github.com/clawdbotatg/slop-computer-wallet" },
  { label: "background", href: "https://github.com/clawdbotatg/slop-computer-background" },
];

export const Footer = () => {
  return (
    <footer className="mt-12 mb-4 px-4">
      <div
        className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-3 text-[11px] slop-mono"
        style={{
          color: "var(--slop-text-muted)",
          borderTop: "1px dashed rgba(255, 62, 201, 0.3)",
        }}
      >
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
          <span>
            <span style={{ color: "var(--slop-accent)" }}>◆</span> MIT repos:
          </span>
          {REPOS.map(r => (
            <a key={r.label} href={r.href} target="_blank" rel="noreferrer" className="slop-link">
              {r.label}
            </a>
          ))}
        </div>
        <a
          href="https://slopcomputer.eth.limo"
          target="_blank"
          rel="noreferrer"
          className="slop-link flex items-center gap-1.5"
        >
          <EthLogo size={32} />
          slopcomputer.eth.limo
        </a>
        <div className="flex items-center gap-4">
          <Link href="/about" className="slop-link">
            about
          </Link>
          <div className="flex items-center gap-2">
            <span>contract ·</span>
            <Address address={contractAddress} size="xs" format="short" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
