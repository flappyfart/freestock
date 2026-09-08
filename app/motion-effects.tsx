"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** An original, silent dither loop. No account data enters the background. */
export function MotionEffects() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.motionPaused = String(paused || reduced);
    return () => {
      delete document.documentElement.dataset.motionPaused;
    };
  }, [paused, reduced]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrast = window.matchMedia(
      "(prefers-contrast: more), (prefers-reduced-transparency: reduce)",
    );
    const sync = () => {
      if (paused || preference.matches || contrast.matches || document.hidden) {
        video.pause();
        return;
      }
      // Defer the video request entirely when the initial preference is static.
      if (!video.getAttribute("src")) video.src = "/motion/dither-flow.mp4";
      void video.play().catch(() => {
        // Autoplay restrictions or a network failure leave the static background available.
      });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    contrast.addEventListener("change", sync);
    return () => {
      video.pause();
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
      contrast.removeEventListener("change", sync);
    };
  }, [paused]);

  return (
    <>
      <div className="ambient-field" aria-hidden="true">
        <video
          className="dither-video"
          ref={videoRef}
          poster="/motion/dither-poster.webp"
          loop
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          disablePictureInPicture
        />
      </div>
      {!reduced && (
        <button
          className="motion-toggle"
          type="button"
          aria-label={paused ? "Resume background animation" : "Pause background animation"}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
          <span>{paused ? "Resume motion" : "Pause motion"}</span>
        </button>
      )}
    </>
  );
}
