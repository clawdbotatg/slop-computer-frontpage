"use client";

import React from "react";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { Button } from "~~/components/ui";

const LIVE_URL = process.env.NEXT_PUBLIC_LIVE_URL || "https://live.slop.computer";

export const Header = () => {
  return (
    <header className="sticky z-30 slop-window border-x-0 border-t-0" style={{ top: 22 }}>
      <div className="slop-titlebar">
        <div className="slop-titlebar__dots" aria-hidden>
          <span className="slop-titlebar__dot" />
          <span className="slop-titlebar__dot" />
          <span className="slop-titlebar__dot" />
        </div>
        <div className="flex-1 truncate">slop.computer ◆ frontpage</div>
        <span className="hidden sm:inline opacity-60">v1.0</span>
      </div>
      <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="slop-bevel-out w-9 h-9 flex items-center justify-center"
            style={{ background: "var(--slop-panel-light)", color: "var(--slop-accent)", fontWeight: 700 }}
          >
            ◆
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold uppercase tracking-wider" style={{ color: "var(--slop-text)" }}>
              slop.computer
            </span>
            <span className="text-xs slop-mono" style={{ color: "var(--slop-text-muted)" }}>
              an onchain podcast for agents that ship
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button as="a" variant="primary" href={LIVE_URL} target="_blank" rel="noreferrer">
            Enter Desktop ▸
          </Button>
          <RainbowKitCustomConnectButton />
        </div>
      </div>
    </header>
  );
};
