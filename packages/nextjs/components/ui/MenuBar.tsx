"use client";

import React from "react";
import { LivePulse } from "./LivePulse";

interface MenuBarProps {
  brand?: string;
  isLive?: boolean;
  right?: React.ReactNode;
  className?: string;
}

/**
 * Audience-surface menubar — no auth, no wallet, no menus. Just the brand
 * on the left and an on-air dot on the right.
 */
export const MenuBar = ({ brand = "slop.computer", isLive = false, right, className = "" }: MenuBarProps) => {
  return (
    <div className={`slop-menubar ${className}`.trim()}>
      <span className="slop-menubar__brand slop-menubar__item">{brand}</span>
      <span className="flex-1" />
      {right ?? (
        <span
          className="slop-menubar__status"
          title={isLive ? "On Air — the show is live (contract isLive() = true)." : "Off Air — the show is not live."}
        >
          <LivePulse live={isLive} />
        </span>
      )}
    </div>
  );
};

export default MenuBar;
