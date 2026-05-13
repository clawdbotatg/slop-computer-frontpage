"use client";

import { useEffect, useRef, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Address } from "@scaffold-ui/components";
import type { Address as AddressType } from "viem";
import { useAccount, useSignMessage } from "wagmi";
import { Button } from "~~/components/ui";
import { type ChatMessage, RELAY_HTTP_URL, useChat } from "~~/hooks/useChat";

/**
 * Embedded chat — messages + input + SIWE flow. Always-visible, fills its
 * container. Used inside the LiveHero when the show is live so signing in
 * and chatting is the primary CTA on the page.
 */
export const Chat = () => {
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
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {messages.length === 0 ? (
          <div className="m-auto text-xs italic px-3 py-6 text-center" style={{ color: "var(--slop-text-muted)" }}>
            no messages yet — be the first to say hi
          </div>
        ) : (
          messages.map(m => (
            <ChatRow key={m.id} msg={m} isMine={!!auth.address && auth.address.toLowerCase() === m.address} />
          ))
        )}
      </div>
      <div
        className="p-3 flex flex-col gap-2"
        style={{
          borderTop: "1px solid rgba(255, 62, 201, 0.25)",
          background: "rgba(6,3,13,0.85)",
        }}
      >
        {auth.authenticated ? (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                maxLength={500}
                placeholder="say something…"
                onChange={e => setDraft(e.target.value)}
                disabled={busy}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className="slop-textfield flex-1"
              />
              <Button onClick={() => void submit()} disabled={!draft.trim() || busy} variant="primary">
                Send
              </Button>
            </div>
            <div className="text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
              signed in as{" "}
              {auth.handle ?? (auth.address ? `${auth.address.slice(0, 6)}…${auth.address.slice(-4)}` : "?")}
            </div>
          </>
        ) : !isConnected ? (
          <>
            <Button onClick={openConnectModal} variant="primary">
              Connect wallet to chat
            </Button>
            <div className="text-[10px] text-center" style={{ color: "var(--slop-text-muted)" }}>
              hang out · drop hot takes · talk to other listeners
            </div>
          </>
        ) : (
          <>
            <Button onClick={() => void runSiwe()} disabled={busy} variant="primary">
              {busy ? "Signing in…" : "Sign in with Ethereum"}
            </Button>
            <div className="text-[10px] text-center" style={{ color: "var(--slop-text-muted)" }}>
              one signature — no password, no email, no email verification
            </div>
          </>
        )}
        {errorText ? (
          <div className="text-[11px]" style={{ color: "var(--slop-accent)" }}>
            {errorText}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const ChatRow = ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => {
  const sourceTag = msg.source === "agent" ? "AGENT" : msg.source === "live" ? "LIVE" : null;
  return (
    <div className="flex gap-2">
      <div
        aria-hidden
        style={{
          width: 3,
          minWidth: 3,
          alignSelf: "stretch",
          background: isMine ? "var(--slop-accent)" : "rgba(255, 62, 201, 0.25)",
        }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide"
          style={{
            color: "var(--slop-text-muted)",
            fontFamily: "var(--slop-font-display)",
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
              className="text-[9px] px-1 leading-tight"
              style={{
                color: "var(--slop-text-muted)",
                border: "1px solid rgba(255, 62, 201, 0.3)",
              }}
            >
              {sourceTag}
            </span>
          ) : null}
        </div>
        <div className="text-[13px] leading-snug break-words whitespace-pre-wrap" style={{ color: "var(--slop-text)" }}>
          {msg.text}
        </div>
      </div>
    </div>
  );
};

export default Chat;
