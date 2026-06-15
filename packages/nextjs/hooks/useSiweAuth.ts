"use client";

import { useCallback } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { RELAY_HTTP_URL } from "~~/hooks/useChat";

// Shared SIWE sign-in against the relay — establishes the `slop_session` cookie
// that the relay's host-gated /admin/* endpoints require. Extracted from the
// inline flow in Chat.tsx so ClipsSection (and anything else) can reuse it.
// Cookie-based: every subsequent relay fetch just needs `credentials: "include"`.
export function useSiweAuth() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const signIn = useCallback(
    async (onError?: (msg: string) => void): Promise<boolean> => {
      if (!address) return false;
      try {
        const nonceRes = await fetch(`${RELAY_HTTP_URL}/auth/siwe/nonce`, { credentials: "include" });
        const { nonce } = (await nonceRes.json()) as { nonce: string };
        const domain = window.location.host;
        const issuedAt = new Date().toISOString();
        const message = `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n\nURI: ${window.location.origin}\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
        const signature = await signMessageAsync({ message });
        const verify = await fetch(`${RELAY_HTTP_URL}/auth/siwe`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, signature, nonce }),
        });
        if (!verify.ok) {
          const j = (await verify.json().catch(() => ({}))) as { error?: string };
          onError?.(j.error ?? `sign-in failed (${verify.status})`);
          return false;
        }
        return true;
      } catch (e) {
        const msg = (e as Error).message || "";
        // A user-cancelled signature isn't an error worth surfacing loudly.
        if (!/cancel|reject|denied|UserRejected/i.test(msg)) onError?.(msg);
        return false;
      }
    },
    [address, signMessageAsync],
  );

  return { signIn, address };
}
