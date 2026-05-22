"use client";

import { useEffect, useState } from "react";
import { ChatRow } from "~~/components/Chat";
import type { ChatMessage } from "~~/hooks/useChat";
import { gatewayUrl } from "~~/types/episode";

/**
 * Renders the pinned chat archive of a finalized episode. `manifest.chat.cid`
 * points at the JSONL the relay snapshots at finalize — one ChatMessage per
 * line. Reuses <ChatRow> so the archive looks identical to the live panel.
 */
export const ChatArchive = ({ cid }: { cid: string | undefined }) => {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!cid) return;
    let cancelled = false;
    fetch(gatewayUrl(`ipfs://${cid}`))
      .then(async res => {
        if (!res.ok) throw new Error(`gateway ${res.status}`);
        const raw = await res.text();
        const parsed: ChatMessage[] = [];
        for (const line of raw.split("\n")) {
          const s = line.trim();
          if (!s) continue;
          try {
            parsed.push(JSON.parse(s) as ChatMessage);
          } catch {
            /* skip corrupt line */
          }
        }
        if (!cancelled) setMessages(parsed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cid]);

  if (!cid) return <Note text="// no chat archive in this manifest" />;
  if (failed) return <Note text="// chat archive failed to load" cid={cid} />;
  if (messages === null) return <Note text="// loading chat archive…" />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="m-auto text-xs italic px-3 py-6 text-center" style={{ color: "var(--slop-text-muted)" }}>
            no chat messages were posted during this episode
          </div>
        ) : (
          messages.map(m => <ChatRow key={m.id} msg={m} isMine={false} />)
        )}
      </div>
      <div className="px-3 py-2" style={{ borderTop: "1px solid rgba(255, 62, 201, 0.2)" }}>
        <a
          href={gatewayUrl(`ipfs://${cid}`)}
          target="_blank"
          rel="noreferrer"
          className="slop-link slop-mono text-[10px]"
        >
          raw chat.jsonl ↗
        </a>
      </div>
    </div>
  );
};

const Note = ({ text, cid }: { text: string; cid?: string }) => (
  <div className="p-3 slop-mono text-[11px] flex flex-col gap-2" style={{ color: "var(--slop-text-muted)" }}>
    <span>{text}</span>
    {cid ? (
      <a href={gatewayUrl(`ipfs://${cid}`)} target="_blank" rel="noreferrer" className="slop-link">
        raw chat.jsonl ↗
      </a>
    ) : null}
  </div>
);
