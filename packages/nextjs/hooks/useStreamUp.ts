"use client";

import { useEffect, useState } from "react";

// Is the live HLS stream actually publishing right now?
//
// The on-chain `live` flag (and the relay's peer-count-based `meta.live`) stay
// set from goLive until the host finalizes — they do NOT track whether OBS is
// actually pushing video. So when the host stops the stream mid-episode, the
// page still thinks it's live and renders a broken player.
//
// MediaMTX serves the HLS manifest with 200 while a publisher is connected and
// 404 once it disconnects (CORS is `*`, so we can poll it cross-origin). We
// fetch the manifest on mount and every `intervalMs` thereafter; `response.ok`
// is the ground truth for "stream is up". Returns:
//   null  — not checked yet (or disabled) — caller shouldn't flip UI yet
//   true  — manifest reachable → stream is live
//   false — manifest 404/unreachable → stream ended/paused
export function useStreamUp(url: string, enabled: boolean, intervalMs = 25000): boolean | null {
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setUp(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        // cache:no-store so a CDN/browser cache can't pin a stale 200/404.
        const res = await fetch(url, { cache: "no-store" });
        if (!cancelled) setUp(res.ok);
      } catch {
        // Network error — treat as down; the next tick re-checks and recovers.
        if (!cancelled) setUp(false);
      }
    };
    void check();
    const id = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, enabled, intervalMs]);

  return up;
}
