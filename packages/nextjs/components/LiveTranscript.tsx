"use client";

import { useEffect, useRef, useState } from "react";
import { Address } from "@scaffold-ui/components";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";

type TranscriptSegment = {
  id: string;
  ts: number;
  address: string | null;
  handle: string | null;
  anonId?: string | null;
  text: string;
  source: "live" | "spectator" | "agent";
};

const POLL_MS = 4000;

/**
 * Live captions panel. Polls the relay's public /v1/transcript?slug=<slug>
 * endpoint and renders the ring of recent STT finals. Each speaker on the
 * Mac OS 9 desktop runs Web Speech (or the god-mode STT relay), pushes
 * finals to the relay, and the relay holds a ~500-segment ring per room.
 *
 * Auto-scrolls to the bottom on new segments — but only if the viewer is
 * already at the bottom (same wasAtBottomRef trick as the Chat panel) so
 * scrolling up to re-read older lines doesn't get yanked away.
 */
export const LiveTranscript = ({ slug }: { slug: string }) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [fetched, setFetched] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/v1/transcript?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) return;
        const j = (await res.json()) as { segments?: TranscriptSegment[] };
        if (!cancelled) {
          setSegments(j.segments ?? []);
          setFetched(true);
        }
      } catch {
        /* relay may be down or slug not active; swallow and keep polling */
      }
    };
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [segments.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {!fetched ? (
          <div className="m-auto text-xs italic px-3 py-6 text-center" style={{ color: "var(--slop-text-muted)" }}>
            connecting…
          </div>
        ) : segments.length === 0 ? (
          <div className="m-auto text-xs italic px-3 py-6 text-center" style={{ color: "var(--slop-text-muted)" }}>
            no transcript segments yet — speakers must enable mic + STT in the room
          </div>
        ) : (
          segments.map(s => <TranscriptRow key={s.id} seg={s} />)
        )}
      </div>
    </div>
  );
};

const TranscriptRow = ({ seg }: { seg: TranscriptSegment }) => (
  <div className="flex flex-col gap-0.5">
    <div className="flex items-center gap-2 slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
      {seg.address ? <Address address={seg.address as `0x${string}`} /> : <span>{seg.handle ?? "anon"}</span>}
      <span>·</span>
      <span>{new Date(seg.ts).toLocaleTimeString()}</span>
    </div>
    <div className="text-sm" style={{ color: "var(--slop-text)" }}>
      {seg.text}
    </div>
  </div>
);
