"use client";

import React from "react";

interface MenuBarProps {
  brand?: string;
  right?: React.ReactNode;
  className?: string;
}

/**
 * Audience-surface menubar — no auth, no wallet, no menus. Just the brand
 * pill on the left. Live/off-air status is communicated by the in-page
 * status banner directly under the chrome, so the menubar stays quiet.
 */
export const MenuBar = ({ brand = "slop.computer", right, className = "" }: MenuBarProps) => {
  return (
    <div className={`slop-menubar ${className}`.trim()}>
      <span className="slop-menubar__brand slop-menubar__item">{brand}</span>
      <span className="flex-1" />
      {right}
    </div>
  );
};

export default MenuBar;
