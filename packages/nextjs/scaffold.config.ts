import { base as baseBase, gnosis as gnosisBase, mainnet as mainnetBase } from "viem/chains";
import type { Chain } from "viem/chains";

export type BaseConfig = {
  targetNetworks: readonly Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  rpcOverrides?: Record<number, string>;
  walletConnectProjectId: string;
  burnerWalletMode: "localNetworksOnly" | "allNetworks" | "disabled";
};

export type ScaffoldConfig = BaseConfig;

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";
const ALCHEMY_MAINNET_RPC = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const ALCHEMY_BASE_RPC = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const ALCHEMY_GNOSIS_RPC = `https://gnosis-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

// Patched chains: viem ships these with public RPCs (eth.merkle.io etc.) that
// get used by any code path reading chain.rpcUrls directly (ENS,
// AddressQRCodeModal) — bypassing wagmi's transport rpcOverrides. Patch the
// chain definitions so every path resolves to Alchemy.
export const mainnet = {
  ...mainnetBase,
  rpcUrls: {
    default: { http: [ALCHEMY_MAINNET_RPC] },
    public: { http: [ALCHEMY_MAINNET_RPC] },
  },
} as const satisfies Chain;

// Base + Gnosis are here only so spectators can `/tip` on them — they mirror
// the relay's TIP_CHAIN_LABELS / the live app's tip chains. mainnet stays
// targetNetworks[0] (the default network for ENS, ETH price, etc.).
export const base = {
  ...baseBase,
  rpcUrls: { default: { http: [ALCHEMY_BASE_RPC] }, public: { http: [ALCHEMY_BASE_RPC] } },
} as const satisfies Chain;

export const gnosis = {
  ...gnosisBase,
  rpcUrls: { default: { http: [ALCHEMY_GNOSIS_RPC] }, public: { http: [ALCHEMY_GNOSIS_RPC] } },
} as const satisfies Chain;

const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [mainnet, base, gnosis],
  // The interval at which your front-end polls the RPC servers for new data (it has no effect if you only target the local network (default is 4000))
  pollingInterval: 30000,
  // Alchemy API key — required for mainnet. If unset, the patched mainnet URL
  // ends with `/v2/` and fails loudly rather than silently falling back.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  // If you want to use a different RPC for a specific network, you can add it here.
  // The key is the chain ID, and the value is the HTTP RPC URL
  rpcOverrides: {
    [mainnet.id]: ALCHEMY_MAINNET_RPC,
    [base.id]: ALCHEMY_BASE_RPC,
    [gnosis.id]: ALCHEMY_GNOSIS_RPC,
  },
  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",
  // Configure Burner Wallet visibility:
  // - "localNetworksOnly": only show when all target networks are local (hardhat/anvil)
  // - "allNetworks": show on any configured target networks
  // - "disabled": completely disable
  burnerWalletMode: "localNetworksOnly",
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
