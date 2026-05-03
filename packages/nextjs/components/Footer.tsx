"use client";

import React from "react";
import { Window } from "~~/components/ui";
import deployedContracts from "~~/contracts/deployedContracts";

const ENS_NAME = "slopcomputer.eth";
const GITHUB_URL = "https://github.com/clawdbotatg/slop-computer-frontpage";
const ENS_URL = `https://app.ens.domains/${ENS_NAME}`;

const contractAddress =
  deployedContracts[1]?.SlopComputerFrontpage?.address ?? "0x0000000000000000000000000000000000000000";
const etherscanUrl = `https://etherscan.io/address/${contractAddress}`;

const links = [
  { label: "Live", href: process.env.NEXT_PUBLIC_LIVE_URL || "https://live.slop.computer" },
  { label: "GitHub", href: GITHUB_URL },
  { label: "BuidlGuidl", href: "https://buidlguidl.com/" },
  { label: "Scaffold-ETH", href: "https://scaffoldeth.io/" },
];

export const Footer = () => {
  return (
    <footer className="mt-12 mx-4 mb-4">
      <Window title="about.txt">
        <div className="px-5 py-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm" style={{ color: "var(--slop-text)" }}>
              <span style={{ color: "var(--slop-accent)" }}>◆</span>{" "}
              <span className="uppercase tracking-wider font-bold">slop.computer</span> — onchain podcast frontpage.
              Episodes pinned to IPFS, indexed on Ethereum mainnet.
            </div>
            <ul className="flex flex-wrap gap-3 text-sm">
              {links.map(l => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="slop-link">
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="slop-divider" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] slop-mono">
            <div className="flex flex-col gap-1">
              <span style={{ color: "var(--slop-text-muted)" }}>ENS</span>
              <a href={ENS_URL} target="_blank" rel="noreferrer" className="slop-link break-all">
                {ENS_NAME}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <span style={{ color: "var(--slop-text-muted)" }}>Contract</span>
              <a href={etherscanUrl} target="_blank" rel="noreferrer" className="slop-link break-all">
                {contractAddress}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <span style={{ color: "var(--slop-text-muted)" }}>Source</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="slop-link break-all">
                {GITHUB_URL.replace("https://", "")}
              </a>
            </div>
          </div>

          <div className="slop-divider" />

          <div
            className="flex flex-wrap items-center justify-between gap-2 text-[10px] slop-mono"
            style={{ color: "var(--slop-text-muted)" }}
          >
            <span>built with scaffold-eth 2 — following ethskills.com</span>
            <span>© 2026 slop.computer · MIT</span>
          </div>
        </div>
      </Window>
    </footer>
  );
};
