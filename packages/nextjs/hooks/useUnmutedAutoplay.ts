import { useEffect } from "react";

/**
 * Start playback WITH sound whenever the browser lets us. Autoplay policy
 * only allows unmuted playback once the site has user-interaction history,
 * so the sequence is:
 *
 *   1. unmute + play() as soon as metadata is ready;
 *   2. verify the unmute actually stuck — Chrome resolves the play() promise
 *      and then pauses/re-mutes a gesture-less unmute;
 *   3. if blocked, fall back to muted playback (video still autoplays) and
 *      lift the mute on the first pointer/key gesture anywhere on the page.
 *
 * `src` retriggers the attempt when the element (re)mounts with a new source
 * — a plain ref dep wouldn't, since ref.current changes don't re-run effects.
 */
export function useUnmutedAutoplay(
  videoRef: { current: HTMLVideoElement | null },
  enabled: boolean,
  src?: string | null,
) {
  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let verifyTimer: ReturnType<typeof setTimeout> | undefined;

    const unmuteOnGesture = () => {
      if (disposed || !video.muted) return;
      video.muted = false;
      if (video.paused) video.play().catch(() => undefined);
    };
    const fallbackMuted = () => {
      if (disposed) return;
      video.muted = true;
      video.play().catch(() => undefined);
      window.addEventListener("pointerdown", unmuteOnGesture, { once: true, capture: true });
      window.addEventListener("keydown", unmuteOnGesture, { once: true, capture: true });
    };
    const attempt = () => {
      if (disposed) return;
      video.muted = false;
      Promise.resolve(video.play())
        .then(() => {
          verifyTimer = setTimeout(() => {
            if (!disposed && (video.paused || video.muted)) fallbackMuted();
          }, 250);
        })
        .catch(fallbackMuted);
    };

    if (video.readyState >= 1) attempt();
    else video.addEventListener("loadedmetadata", attempt, { once: true });

    return () => {
      disposed = true;
      if (verifyTimer) clearTimeout(verifyTimer);
      video.removeEventListener("loadedmetadata", attempt);
      window.removeEventListener("pointerdown", unmuteOnGesture, { capture: true });
      window.removeEventListener("keydown", unmuteOnGesture, { capture: true });
    };
  }, [videoRef, enabled, src]);
}
