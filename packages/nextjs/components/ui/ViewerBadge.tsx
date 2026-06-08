import React from "react";

interface ViewerBadgeProps {
  /** Live spectator count, or null while it's still unknown. */
  count: number | null;
  className?: string;
  style?: React.CSSProperties;
}

// "👁 N watching" — the live spectator count for a room (people currently on
// its page with the chat stream open). Renders nothing until the count is
// known so we never flash a placeholder; `0` IS shown once known (callers that
// don't want a "0 watching" can gate on count > 0 themselves).
export const ViewerBadge = ({ count, className = "", style }: ViewerBadgeProps) => {
  if (count == null) return null;
  return (
    <span
      className={`slop-mono inline-flex items-center gap-1.5 ${className}`.trim()}
      style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--slop-text-muted)", ...style }}
      title={`${count} ${count === 1 ? "person is" : "people are"} watching right now`}
    >
      <span aria-hidden>👁</span>
      {count} watching
    </span>
  );
};

export default ViewerBadge;
