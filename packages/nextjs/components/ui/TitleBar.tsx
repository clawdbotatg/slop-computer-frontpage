import React from "react";

interface TitleBarProps {
  title: React.ReactNode;
  active?: boolean;
  right?: React.ReactNode;
  showDots?: boolean;
}

export const TitleBar = ({ title, active = false, right, showDots = true }: TitleBarProps) => {
  return (
    <div className={`slop-titlebar ${active ? "slop-titlebar--active" : ""}`}>
      {showDots && (
        <div className="slop-titlebar__dots" aria-hidden>
          <span className="slop-titlebar__dot" />
          <span className="slop-titlebar__dot" />
          <span className="slop-titlebar__dot" />
        </div>
      )}
      <div className="flex-1 truncate">{title}</div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
};
