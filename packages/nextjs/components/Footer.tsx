"use client";

import React from "react";
import externalContracts from "~~/contracts/externalContracts";

const contractAddress = externalContracts[1].SlopComputer.address;
const etherscanUrl = `https://etherscan.io/address/${contractAddress}`;

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
        <span>
          <span style={{ color: "var(--slop-accent)" }}>◆</span> slop.computer · onchain
        </span>
        <a href={etherscanUrl} target="_blank" rel="noreferrer" className="slop-link break-all">
          contract · {contractAddress}
        </a>
      </div>
    </footer>
  );
};

export default Footer;
