"use client";

import type { ReactNode } from "react";

// "Listen on" pills — RSS / Spotify / Apple Podcasts — so people know the show
// is a regular podcast too. Brand-tinted rounded pills with an inline icon,
// pinned to the top-left of the viewport on every page (stays put on scroll).
const LISTEN_ON: { label: string; href: string; color: string; icon: ReactNode }[] = [
  {
    label: "RSS",
    href: "/feed.xml",
    color: "#ff9a3c",
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 10a7.31 7.31 0 0 0 10 10Z" />
        <path d="m9 15 3-3" />
        <path d="M17 13a6 6 0 0 0-6-6" />
        <path d="M21 13A10 10 0 0 0 11 3" />
      </svg>
    ),
  },
  {
    label: "Spotify",
    href: "https://open.spotify.com/show/4IA364aVPvjh3SWTT9rToS",
    color: "#1ed760",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
  {
    label: "Apple Podcasts",
    href: "https://podcasts.apple.com/us/podcast/slop-computer/id6810863494",
    color: "#c56bff",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
];

export const ListenOn = () => (
  <nav aria-label="Listen on" className="fixed top-3 left-3 sm:left-4 z-40 flex flex-wrap items-center gap-2">
    {LISTEN_ON.map(({ label, href, color, icon }) => (
      <a
        key={label}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        title={label}
        className="slop-mono text-xs sm:text-sm inline-flex items-center gap-1.5"
        style={{
          color,
          background: `${color}1f`,
          border: `1px solid ${color}99`,
          borderRadius: 9999,
          padding: "5px 12px",
          textDecoration: "none",
          textTransform: "none",
          boxShadow: `0 0 8px ${color}33`,
          backdropFilter: "blur(6px)",
        }}
      >
        {icon}
        <span>{label}</span>
      </a>
    ))}
  </nav>
);

export default ListenOn;
