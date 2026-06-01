"use client";

import { RELAY_HTTP_URL } from "./useChat";
import { useCallback } from "react";
import type { Address as AddressType } from "viem";
import { parseEther } from "viem";
import { useAccount, useChainId, useSendTransaction, useSwitchChain } from "wagmi";

// Spectator-side `/tip`. Mirrors the live app's hooks/useTip.ts, but the front
// page isn't on the peer mesh — so it learns the room multisig over HTTP
// (/v1/wallet), sends ETH from the viewer's own wallet via wagmi, then tells
// the relay over HTTP (/v1/tip/announce) instead of the mesh's tip_announce
// WS message. The relay posts the attributed chat line (we see it echo back
// over SSE) and fires the flying-card event for the live stream.

// Chains a /tip can target — mirrors the relay's TIP_CHAIN_LABELS and the
// live app. Names map to chainId; "eth"/"ether" are the token, NOT a chain
// (so "0.001 base eth" → chain=base). These chainIds must be present in
// scaffold.config targetNetworks or switchChain will reject them.
const CHAIN_BY_NAME: Record<string, number> = {
  base: 8453,
  ethereum: 1,
  mainnet: 1,
  gnosis: 100,
  xdai: 100,
};
const CHAIN_LABELS: Record<number, string> = { 1: "Ethereum", 8453: "Base", 100: "Gnosis" };
const NOISE = new Set(["eth", "ether", "on", "the", "room", "to", "tip", "of"]);
const DEFAULT_CHAIN = 8453; // Base

// Cheap, free, instant parse of the clean case ("0.001 base eth"). Returns
// null for anything fuzzy so the caller falls back to the (rate-limited) AI
// parser at /v1/tip/parse. Bails on ambiguity (two numbers, two chains,
// unknown words).
export function parseTipFast(text: string): { amountEth: string; chainId: number } | null {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let amountEth: string | null = null;
  let chainId: number | null = null;
  for (const w of words) {
    if (/^[0-9]*\.?[0-9]+$/.test(w)) {
      if (amountEth) return null;
      amountEth = w;
    } else if (w in CHAIN_BY_NAME) {
      if (chainId) return null;
      chainId = CHAIN_BY_NAME[w] ?? null;
    } else if (!NOISE.has(w)) {
      return null;
    }
  }
  if (!amountEth || Number(amountEth) <= 0) return null;
  return { amountEth, chainId: chainId ?? DEFAULT_CHAIN };
}

export function useTip(slug: string): (arg: string, notify: (text: string) => void) => Promise<void> {
  const { address } = useAccount();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  return useCallback(
    async (arg: string, notify: (text: string) => void) => {
      if (!address) {
        notify("connect your wallet first, then /tip.");
        return;
      }

      // Where to send — the room multisig (public, on-chain address).
      let multisig: string | null = null;
      try {
        const res = await fetch(`${RELAY_HTTP_URL}/v1/wallet?slug=${encodeURIComponent(slug)}`, {
          credentials: "include",
        });
        if (res.ok) multisig = ((await res.json()) as { address?: string | null }).address ?? null;
      } catch {
        /* fall through to the no-wallet message */
      }
      if (!multisig) {
        notify("no room wallet deployed yet — nothing to tip.");
        return;
      }

      let parsed = parseTipFast(arg);
      if (!parsed) {
        notify("reading your tip…");
        try {
          const res = await fetch(`${RELAY_HTTP_URL}/v1/tip/parse`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: arg }),
          });
          const j = (await res.json()) as { ok?: boolean; amountEth?: string; chainId?: number; error?: string };
          if (!j.ok || typeof j.amountEth !== "string" || typeof j.chainId !== "number") {
            notify(j.error ?? "couldn't read that — try `/tip 0.001 base eth`");
            return;
          }
          parsed = { amountEth: j.amountEth, chainId: j.chainId };
        } catch {
          notify("tip parser unavailable — try `/tip 0.001 base eth`");
          return;
        }
      }

      const { amountEth, chainId } = parsed;
      const label = CHAIN_LABELS[chainId] ?? `chain ${chainId}`;
      notify(`preparing tip of ${amountEth} ETH on ${label}…`);

      try {
        const value = parseEther(amountEth);
        if (currentChainId !== chainId) {
          await switchChainAsync({ chainId });
        }
        const hash = await sendTransactionAsync({ to: multisig as AddressType, value, chainId });
        // Tell the relay so it posts the chat line + drives the live-stream
        // flying card. Fire-and-forget-ish: the tx already landed, so a failed
        // announce shouldn't read as a failed tip.
        try {
          await fetch(`${RELAY_HTTP_URL}/v1/tip/announce`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ amountEth, chainId }),
          });
        } catch {
          /* tx is on-chain regardless; the announce is just the chat flourish */
        }
        notify(`✓ tipped ${amountEth} ETH on ${label} — ${hash.slice(0, 10)}…`);
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        notify(/reject|denied|cancel/i.test(m) ? "tip cancelled." : `tip failed: ${m.slice(0, 120)}`);
      }
    },
    [address, currentChainId, switchChainAsync, sendTransactionAsync, slug],
  );
}
