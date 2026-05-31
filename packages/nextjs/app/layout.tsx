import { JetBrains_Mono, Silkscreen } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  weight: "400",
  subsets: ["latin"],
});

// The ANSI-Shadow wordmark on the homepage is live monospace text built from
// full-block (█) and box-drawing (╔═╗║╚╝) glyphs. We must SHIP a webfont that
// covers those at a uniform advance — relying on locally-installed fonts
// (SF Mono / Menlo) breaks on Android/Windows, where the generic `monospace`
// fallback lacks the glyphs and per-glyph substitution drifts the columns into
// garbage. JetBrains Mono has full block + box-drawing coverage.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: "400",
  subsets: ["latin"],
});

export const metadata = getMetadata({
  title: "slop.computer — onchain podcast",
  description:
    "An onchain podcast about agents, builders, and shipping software. Episodes pinned to IPFS, indexed on Ethereum mainnet.",
});

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      suppressHydrationWarning
      lang="en"
      data-theme="dark"
      className={`${silkscreen.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider defaultTheme="dark" forcedTheme="dark">
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
