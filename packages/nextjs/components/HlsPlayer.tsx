"use client";

import { useEffect, useRef, useState } from "react";

interface HlsPlayerProps {
  src: string;
  className?: string;
}

/**
 * Browser HLS player. Native on Safari/iOS, hls.js everywhere else.
 * `muted + playsInline + autoplay` is required for browsers to start
 * playback without a user gesture.
 */
export const HlsPlayer = ({ src, className }: HlsPlayerProps) => {
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
    <div className={`relative bg-black ${className ?? ""}`.trim()}>
      <video
        ref={videoRef}
        controls
        autoPlay
        playsInline
        muted
        className="block w-full h-full"
        style={{ background: "#000" }}
      />
      {error ? (
        <div
          className="absolute left-0 right-0 bottom-0 px-3 py-2 text-xs slop-mono"
          style={{ color: "var(--slop-live)", background: "rgba(0,0,0,0.65)" }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default HlsPlayer;
