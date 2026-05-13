"use client";

import { useEffect, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { Footer } from "~~/components/Footer";
import { BlockieAvatar } from "~~/components/scaffold-eth";
import { DesktopBackground, MenuBar } from "~~/components/ui";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { ZERO_BYTES32 } from "~~/types/episode";

/**
 * Right-side menubar strip — persistent show status. Replaces the in-page
 * status banner so off-air / live / episode count is always one glance away
 * regardless of which view the visitor is on.
 */
const MenuBarStatus = () => {
  const { data: live } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "live",
  });
  const { data: episodeCount } = useScaffoldReadContract({
    contractName: "SlopComputer",
    functionName: "episodeCount",
  });

  const isLive = !!live && live !== ZERO_BYTES32;
  const total = episodeCount !== undefined ? Number(episodeCount) : undefined;
  const dotColor = isLive ? "var(--slop-lime)" : "var(--slop-red)";

  return (
    <span className="inline-flex items-center gap-3 px-3 h-full text-[12px] tracking-widest">
      <span className="inline-flex items-center gap-1.5">
        <span className={`slop-pulse${isLive ? "" : " slop-pulse--off"}`} aria-hidden />
        <span style={{ color: dotColor, fontWeight: 700, textShadow: `0 0 6px ${dotColor}` }}>
          {isLive ? "live" : "off air"}
        </span>
      </span>
      {!isLive ? (
        <>
          <Dot />
          <span className="hidden sm:inline" style={{ color: "var(--slop-text)" }}>
            next: coming soon
          </span>
        </>
      ) : null}
      <Dot className="hidden md:inline" />
      <span className="hidden md:inline" style={{ color: "var(--slop-text-muted)" }}>
        {total === undefined ? "…" : `${total} ep${total === 1 ? "" : "s"}`}
      </span>
    </span>
  );
};

const Dot = ({ className }: { className?: string }) => (
  <span className={className} style={{ opacity: 0.45 }} aria-hidden>
    ·
  </span>
);

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <DesktopBackground />
      <MenuBar right={<MenuBarStatus />} />
      <div className="relative flex flex-col min-h-screen" style={{ paddingTop: 38, zIndex: 1 }}>
        <main className="relative flex flex-col flex-1">{children}</main>
        <Footer />
      </div>
      <Toaster />
    </>
  );
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

export const ScaffoldEthAppWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          avatar={BlockieAvatar}
          theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
        >
          <ProgressBar height="3px" color="#2299dd" />
          <ScaffoldEthApp>{children}</ScaffoldEthApp>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
