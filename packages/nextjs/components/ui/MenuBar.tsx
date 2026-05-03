import React from "react";

interface MenuBarProps {
  brand?: string;
  items?: string[];
  right?: React.ReactNode;
  className?: string;
}

export const MenuBar = ({
  brand = "Slop",
  items = ["File", "Live", "Wallet"],
  right,
  className = "",
}: MenuBarProps) => {
  return (
    <div className={`slop-menubar ${className}`.trim()}>
      <span className="slop-menubar__brand slop-menubar__item">{brand}</span>
      {items.map(item => (
        <span key={item} className="slop-menubar__item">
          {item} <span aria-hidden>▾</span>
        </span>
      ))}
      <span className="flex-1" />
      {right}
    </div>
  );
};
