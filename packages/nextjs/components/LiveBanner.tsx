"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button, LivePulse, Window } from "~~/components/ui";

interface LiveBannerProps {
  isLive: boolean | undefined;
  liveTitle?: string;
  liveHlsUrl?: string;
}

const DEFAULT_HLS_URL = process.env.NEXT_PUBLIC_HLS_URL || "https://media.slop.computer/hls/live/index.m3u8";

const HlsPlayer = ({ src }: { src: string }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroy: (() => void) | undefined;
    let cancelled = false;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else {
      import("hls.js")
        .then(mod => {
          if (cancelled) return;
          const Hls = mod.default;
          if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_e, data) => {
              if (data.fatal) setError("stream error — please retry");
            });
            destroy = () => hls.destroy();
          } else {
            setError("HLS not supported in this browser");
          }
        })
        .catch(() => setError("failed to load player"));
    }

    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [src]);

  return (
    <div className="slop-bevel-in" style={{ background: "#000" }}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxHeight: "60vh", display: "block", background: "#000" }}
      />
      {error && (
        <div className="px-3 py-2 text-xs slop-mono" style={{ color: "var(--slop-live)" }}>
          {error}
        </div>
      )}
    </div>
  );
};

export const LiveBanner = ({ isLive, liveTitle, liveHlsUrl }: LiveBannerProps) => {
  const live = !!isLive;
  const src = liveHlsUrl && liveHlsUrl.length > 0 ? liveHlsUrl : DEFAULT_HLS_URL;
  const titleText = live ? (liveTitle && liveTitle.length > 0 ? liveTitle : "Live now") : "Off air";

  return (
    <Window
      title={live ? `Live ◆ ${titleText}` : "StreamingNow.app"}
      active={live}
      titleRight={
        <span className="slop-mono text-[10px]" style={{ color: "var(--slop-text-muted)" }}>
          {live ? "▶ stream" : "// idle"}
        </span>
      }
    >
      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {live ? (
              <LivePulse label="Live" />
            ) : (
              <span className="inline-block w-2 h-2" style={{ background: "var(--slop-text-muted)" }} aria-hidden />
            )}
            <div>
              <div className="text-base uppercase tracking-wide" style={{ color: "var(--slop-text)" }}>
                {titleText}
              </div>
              <div className="text-xs slop-mono" style={{ color: "var(--slop-text-muted)" }}>
                {live ? "A new episode is being recorded — tune in." : "Catch up on past episodes below."}
              </div>
            </div>
          </div>
          {!live && (
            <span className="text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
              {"// next recording: TBA"}
            </span>
          )}
        </div>
        {live && <HlsPlayer src={src} />}
        {live && (
          <div className="flex items-center gap-2 text-[11px] slop-mono" style={{ color: "var(--slop-text-muted)" }}>
            <span>source:</span>
            <span style={{ color: "var(--slop-text)" }}>{src}</span>
          </div>
        )}
        {!live && (
          <div className="flex items-center gap-2">
            <Button as="a" href="#episodes" variant="primary">
              Browse episodes ▾
            </Button>
          </div>
        )}
      </div>
    </Window>
  );
};
