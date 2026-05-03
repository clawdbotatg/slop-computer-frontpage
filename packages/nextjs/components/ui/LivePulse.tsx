import React from "react";

interface LivePulseProps {
  className?: string;
  label?: string;
}

export const LivePulse = ({ className = "", label }: LivePulseProps) => {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span className="slop-pulse" aria-hidden />
      {label && (
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--slop-live)" }}>
          {label}
        </span>
      )}
    </span>
  );
};
