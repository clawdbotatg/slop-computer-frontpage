"use client";

import React from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { Address as AddressType } from "viem";
import externalContracts from "~~/contracts/externalContracts";

const contractAddress = externalContracts[1].SlopComputer.address as AddressType;

// All four halves of the project are open source (MIT). Order mirrors the
// stack: what you're looking at, the chain it reads, the relay it streams
// from, and the multisig that owns it.
const REPOS: { label: string; href: string }[] = [
  { label: "frontend", href: "https://github.com/clawdbotatg/slop-computer-frontpage" },
  { label: "contracts", href: "https://github.com/clawdbotatg/slop-computer-contracts" },
  { label: "live", href: "https://github.com/clawdbotatg/slop-computer-live" },
  { label: "multisig", href: "https://github.com/clawdbotatg/slop-computer-wallet" },
];

export const Footer = () => {
  return (
    <footer className="mt-12 mb-4 px-4">
      <div
        className="max-w-6xl mx-auto flex flex-col gap-3 px-3 py-3 text-[11px] slop-mono"
        style={{
          color: "var(--slop-text-muted)",
          borderTop: "1px dashed rgba(255, 62, 201, 0.3)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <span style={{ color: "var(--slop-accent)" }}>◆</span> slop.computer · onchain
          </span>
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
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1">
          <span>MIT repo:</span>
          {REPOS.map(r => (
            <a key={r.label} href={r.href} target="_blank" rel="noreferrer" className="slop-link">
              {r.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
