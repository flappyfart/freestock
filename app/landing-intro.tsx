"use client";
/* oxlint-disable next/no-img-element -- Local vector brand mark inside the cinematic intro. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

const INTRO_KEY = "freestock-nvidia-intro-v2";

export function LandingIntro() {
  const [visible, setVisible] = useState(true);
  const introRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const dismiss = useCallback(() => {
    if (introRef.current?.contains(document.activeElement)) {
      document.querySelector<HTMLAnchorElement>(".wordmark")?.focus({ preventScroll: true });
    }
    setVisible(false);
    try {
      sessionStorage.setItem(INTRO_KEY, "seen");
    } catch {
      // Storage may be unavailable; the finite intro still exits normally.
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let seen = false;
    try {
      seen = sessionStorage.getItem(INTRO_KEY) === "seen";
    } catch {
      // Do not make storage a prerequisite for entering the app.
    }
    if (preference.matches || seen || window.location.hash) {
      const skip = window.requestAnimationFrame(dismiss);
      return () => window.cancelAnimationFrame(skip);
    }

    document.documentElement.dataset.introPlaying = "true";
    const skipOnKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Tab") dismiss();
    };
    const skipOnFocus = (event: FocusEvent) => {
      if (!introRef.current?.contains(event.target as Node)) dismiss();
    };
    const skipOnPreference = () => {
      if (preference.matches) dismiss();
    };
    // A slow, rejected, or failed video never holds the page hostage.
    const deadline = window.setTimeout(dismiss, 3500);
    void videoRef.current?.play().catch(dismiss);
    window.addEventListener("keydown", skipOnKey, true);
    window.addEventListener("focusin", skipOnFocus);
    preference.addEventListener("change", skipOnPreference);
    return () => {
      window.clearTimeout(deadline);
      window.removeEventListener("keydown", skipOnKey, true);
      window.removeEventListener("focusin", skipOnFocus);
      preference.removeEventListener("change", skipOnPreference);
      delete document.documentElement.dataset.introPlaying;
    };
  }, [dismiss, visible]);

  if (!visible) return null;

  return (
    <div className="landing-intro" ref={introRef}>
      <div className="intro-scene" aria-hidden="true">
        <video
          ref={videoRef}
          className="intro-hands"
          src="/motion/nvidia-arrival-clean.mp4"
          muted
          playsInline
          preload="none"
          onError={dismiss}
          tabIndex={-1}
          disablePictureInPicture
        />
        <div className="intro-card-anchor">
          <div className="intro-stock-card">
            <div className="intro-card-top">
              <img src="/stocks/NVDA.svg" alt="" width="44" height="44" />
              <span>NVIDIA</span>
              <ArrowUpRight size={18} />
            </div>
            <div className="intro-card-symbol">NVDA</div>
            <p>Put your earnings toward NVIDIA.</p>
            <div className="intro-card-bottom">
              <span>freestock</span>
              <span>EARN IN STOCK</span>
            </div>
          </div>
        </div>
      </div>
      <div className="intro-wordmark" aria-hidden="true">
        freestock
      </div>
      <p className="intro-caption" aria-hidden="true">
        Your DeFi earnings. Your stock picks.
      </p>
      <button className="intro-skip" type="button" onClick={dismiss}>
        Skip intro <ArrowUpRight size={15} />
      </button>
    </div>
  );
}
