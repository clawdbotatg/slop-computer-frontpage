"use client";

import { useEffect, useState } from "react";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";

// Poll the relay's public per-room meta (`/v1/rooms/:slug/meta`) for the live
// viewer count. Use this where we want the number but don't already hold an
// open chat-stream connection — e.g. the homepage live card. On the room page
// itself, `useChat` surfaces the same count in realtime over its SSE stream,
// so prefer that there rather than adding a second poll.
//
// Returns null until the first successful read (and while disabled), so a
// caller can choose to render nothing rather than flash a placeholder.
export function useViewerCount(slug: string, enabled: boolean, intervalMs = 8000): number | null {
  const [viewers, setViewers] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || !slug) {
      setViewers(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/v1/rooms/${encodeURIComponent(slug)}/meta`);
        if (!res.ok) return;
        const j = (await res.json()) as { viewers?: unknown };
        if (!cancelled && typeof j.viewers === "number") setViewers(j.viewers);
      } catch {
        /* transient — keep the last known value and retry on the next tick */
      }
    };
    void poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, enabled, intervalMs]);

  return viewers;
}
