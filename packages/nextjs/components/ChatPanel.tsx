"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import type { Address as AddressType } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { Button, Window } from "~~/components/ui";
import { type ChatMessage, RELAY_HTTP_URL, useChat } from "~~/hooks/useChat";

// Spectator chat for slop.computer. Floating panel pinned to the bottom
// right; collapsible into a thin tab so the homepage isn't dominated.
// Sign-in path: connect wallet → SIWE → relay sets the slop_session cookie
// (same cookie the live desktop uses, scoped to the relay's host).
export const ChatPanel = () => {
  const [collapsed, setCollapsed] = useState(true);
  const { messages } = useChat();

  // Newest message lights up a "1" badge on the collapsed tab so the user
  // notices activity. We track the id seen at last open + reset on open.
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  useEffect(() => {
    if (!collapsed) {
      const newest = messages[messages.length - 1];
      if (newest) setLastSeenId(newest.id);
    }
  }, [collapsed, messages]);

  const unreadCount = useMemo(() => {
    if (!lastSeenId) return collapsed ? messages.length : 0;
    const idx = messages.findIndex(m => m.id === lastSeenId);
    return idx === -1 ? messages.length : messages.length - idx - 1;
  }, [messages, lastSeenId, collapsed]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="open chat"
        className="slop-window"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 1000,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          fontFamily: "var(--slop-font-display, monospace)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: 12,
          color: "var(--slop-text)",
        }}
      >
        <span>▣ Chat</span>
        {unreadCount > 0 ? (
          <span
            style={{
              background: "var(--slop-accent, #ff3ec9)",
              color: "#000",
              padding: "1px 6px",
              fontSize: 10,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1000,
        width: "min(360px, 92vw)",
        height: "min(480px, 70vh)",
      }}
    >
      <Window
        title="Chat"
        active
        onClose={() => setCollapsed(true)}
        bodyClassName="flex-1 min-h-0"
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <ChatBody />
      </Window>
    </div>
  );
};

// Body split off so the SSE/state lives next to the rendering, and the
// collapsed-tab path doesn't pay for the auth refresh cost.
const ChatBody = () => {
  const { messages, auth, send, refreshAuth } = useChat();
  const { address: walletAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
  };

  const runSiwe = async () => {
    if (!walletAddress) return;
    setBusy(true);
    setErrorText("");
    try {
      const nonceRes = await fetch(`${RELAY_HTTP_URL}/auth/siwe/nonce`, { credentials: "include" });
      const { nonce } = (await nonceRes.json()) as { nonce: string };
      const domain = window.location.host;
      const issuedAt = new Date().toISOString();
      const message = `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\n\nURI: ${window.location.origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
      const signature = await signMessageAsync({ message });
      const verify = await fetch(`${RELAY_HTTP_URL}/auth/siwe`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature, nonce }),
      });
      if (!verify.ok) {
        const j = await verify.json().catch(() => ({}));
        setErrorText(j.error ?? `sign-in failed (${verify.status})`);
      } else {
        await refreshAuth();
      }
    } catch (e) {
      const msg = (e as Error).message || "";
      // User rejected the signature — quietly clear, don't shout.
      if (!/cancel|reject|denied|UserRejected/i.test(msg)) setErrorText(msg);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setErrorText("");
    try {
      const res = await send(text);
      if (res.ok) {
        setDraft("");
      } else if (res.error === "rate-limited") {
        setErrorText("slow down — try again in a sec");
      } else if (res.error === "unauthenticated") {
        setErrorText("session expired — please sign in again");
      } else {
        setErrorText(res.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        ref={listRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              color: "var(--slop-text-muted)",
              fontSize: 12,
              fontStyle: "italic",
              padding: 12,
              textAlign: "center",
            }}
          >
            no messages yet
          </div>
        ) : (
          messages.map(m => (
            <ChatRow key={m.id} msg={m} isMine={!!auth.address && auth.address.toLowerCase() === m.address} />
          ))
        )}
      </div>
      <div
        style={{
          padding: 8,
          borderTop: "1px solid var(--slop-bevel-light, #4a4a4a)",
          background: "rgba(6,3,13,0.85)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {auth.authenticated ? (
          <>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="text"
                value={draft}
                maxLength={500}
                placeholder="message…"
                onChange={e => setDraft(e.target.value)}
                disabled={busy}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  background: "#06030d",
                  border: "1px solid var(--slop-bevel-light, #4a4a4a)",
                  color: "var(--slop-text)",
                  fontFamily: "var(--slop-font-body, sans-serif)",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <Button onClick={() => void submit()} disabled={!draft.trim() || busy} variant="primary">
                Send
              </Button>
            </div>
            <div style={{ fontSize: 10, color: "var(--slop-text-muted)" }}>
              signed in as {auth.handle ?? (auth.address ? `${auth.address.slice(0, 6)}…${auth.address.slice(-4)}` : "?")}
            </div>
          </>
        ) : !isConnected ? (
          <Button onClick={openConnectModal} variant="primary">
            Connect Wallet to Chat
          </Button>
        ) : (
          <Button onClick={() => void runSiwe()} disabled={busy} variant="primary">
            {busy ? "Signing in…" : "Sign in to Chat"}
          </Button>
        )}
        {errorText ? (
          <div style={{ fontSize: 11, color: "var(--slop-accent, #ff3ec9)" }}>{errorText}</div>
        ) : null}
      </div>
    </div>
  );
};

const ChatRow = ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => {
  const sourceTag = msg.source === "agent" ? "AGENT" : msg.source === "live" ? "LIVE" : null;
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div
        aria-hidden
        style={{
          width: 3,
          minWidth: 3,
          alignSelf: "stretch",
          background: isMine ? "var(--slop-accent, #ff3ec9)" : "var(--slop-bevel-light, #4a4a4a)",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--slop-text-muted)",
            fontFamily: "var(--slop-font-display, monospace)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {msg.address ? (
            <Address address={msg.address as AddressType} size="xs" onlyEnsOrAddress disableAddressLink />
          ) : (
            <span>{msg.handle ?? "anon"}</span>
          )}
          {isMine ? <span style={{ opacity: 0.7 }}>(you)</span> : null}
          {sourceTag ? (
            <span
              style={{
                fontSize: 9,
                padding: "0 4px",
                color: "var(--slop-text-muted)",
                border: "1px solid var(--slop-bevel-light, #4a4a4a)",
                letterSpacing: "0.06em",
              }}
            >
              {sourceTag}
            </span>
          ) : null}
        </div>
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "var(--slop-text)",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
