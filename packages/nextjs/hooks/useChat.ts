"use client";

import { useCallback, useEffect, useState } from "react";

export const RELAY_HTTP_URL = process.env.NEXT_PUBLIC_RELAY_HTTP_URL ?? "https://live.slop.computer";

export type ChatMessage = {
  id: string;
  ts: number;
  address: string | null;
  handle: string | null;
  text: string;
  source: "live" | "spectator" | "agent";
};

export type ChatAuth = {
  authenticated: boolean;
  address: string | null;
  handle: string | null;
};

const HISTORY_CAP = 200;

// Spectator-side chat hook. Reads via SSE for live updates (cheaper than
// keeping a WS open from the front page), writes via POST. Auth is whatever
// slop_session cookie the relay set on us — same cookie as live.slop.computer
// since both share `slop.computer` as eTLD+1, and SIWE here mints a session
// cookie scoped to the relay's host.
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [auth, setAuth] = useState<ChatAuth>({ authenticated: false, address: null, handle: null });
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>("");

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch(`${RELAY_HTTP_URL}/auth/me`, { credentials: "include" });
      if (!res.ok) {
        setAuth({ authenticated: false, address: null, handle: null });
        return;
      }
      const j = await res.json();
      setAuth({
        authenticated: !!j.authenticated,
        address: typeof j.address === "string" ? j.address : null,
        handle: typeof j.handle === "string" ? j.handle : null,
      });
    } catch {
      setAuth({ authenticated: false, address: null, handle: null });
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  // SSE stream — reconnects on close after a short backoff so a relay
  // restart or a sleeping laptop doesn't leave the panel silent.
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      try {
        es = new EventSource(`${RELAY_HTTP_URL}/v1/chat/stream`, { withCredentials: true });
      } catch (e) {
        setError((e as Error).message);
        return;
      }
      es.addEventListener("init", e => {
        try {
          const data = JSON.parse((e as MessageEvent).data) as { messages: ChatMessage[] };
          setMessages(data.messages.slice(-HISTORY_CAP));
        } catch {
          /* skip bad init */
        }
      });
      es.addEventListener("chat", e => {
        try {
          const cm = JSON.parse((e as MessageEvent).data) as ChatMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === cm.id)) return prev;
            const next = [...prev, cm];
            return next.length > HISTORY_CAP ? next.slice(-HISTORY_CAP) : next;
          });
        } catch {
          /* skip bad chat msg */
        }
      });
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        es = null;
        if (!cancelled) {
          retryTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed) return { ok: false, error: "empty" } as const;
    const res = await fetch(`${RELAY_HTTP_URL}/v1/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });
    if (res.status === 401) {
      setAuth({ authenticated: false, address: null, handle: null });
      return { ok: false, error: "unauthenticated" } as const;
    }
    if (res.status === 429) return { ok: false, error: "rate-limited" } as const;
    if (!res.ok) return { ok: false, error: `http-${res.status}` } as const;
    return { ok: true } as const;
  }, []);

  return { messages, auth, connected, error, send, refreshAuth };
}
