import { Silkscreen } from "next/font/google";
import "@rainbow-me/rainbowkit/styles.css";
import "@scaffold-ui/components/styles.css";
import { ScaffoldEthAppWithProviders } from "~~/components/ScaffoldEthAppWithProviders";
import { ThemeProvider } from "~~/components/ThemeProvider";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";
import { SITE_DESCRIPTION } from "~~/utils/site";

const silkscreen = Silkscreen({
  variable: "--font-silkscreen",
  weight: "400",
  subsets: ["latin"],
});

export const metadata = {
  ...getMetadata({
    title: "slop.computer — an AI × crypto podcast",
    description: SITE_DESCRIPTION,
  }),
  // <link rel="alternate"> pointers so agents scraping the HTML head find the
  // machine-readable surfaces without guessing paths (also in llms.txt +
  // robots.txt + the visible hero/footer links).
  alternates: {
    types: {
      "text/markdown": "/skill.md",
      "application/json": "/episodes.json",
      "application/rss+xml": "/feed.xml",
    },
  },
};

const ScaffoldEthApp = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning lang="en" data-theme="dark" className={silkscreen.variable}>
      <body>
        <ThemeProvider defaultTheme="dark" forcedTheme="dark">
          <ScaffoldEthAppWithProviders>{children}</ScaffoldEthAppWithProviders>
        </ThemeProvider>
      </body>
    </html>
  );
};

export default ScaffoldEthApp;
