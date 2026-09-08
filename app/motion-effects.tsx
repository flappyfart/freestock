"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/** A decorative, bounded dot field. No market/account data enters the animation. */
export function MotionEffects() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !context) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let previous = 0;
    let time = 0;
    let points: { x: number; y: number; u: number; v: number; phase: number }[] = [];

    const paint = () => {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#0066ff";
      for (const point of points) {
        const { u, v } = point;
        // Interference bands curl around an open center, keeping copy readable.
        const bend = Math.sin(v * 7 + time * 0.18) * 0.35;
        const wave = Math.sin(u * 9 + v * 5 + bend * 4 + time * 0.32);
        const cross = Math.cos(v * 10 - u * 4 - time * 0.23);
        const density = Math.pow(Math.max(0, (wave + cross + 2) / 4), 2.4);
        const edge = 0.1 + 0.9 * Math.pow(Math.min(1, Math.abs(u) * 1.2), 1.5);
        const alpha = density * edge * 0.2;
        if (alpha < 0.015) continue;
        const size = 0.7 + density * 1.7;
        const drift = Math.sin(time * 0.38 + point.phase) * 2;
        context.globalAlpha = alpha;
        context.fillRect(point.x + drift, point.y, size, size);
        // Sparse little glyphs carry the ASCII texture in the supplied references.
        if (density > 0.72 && point.phase > 5.8) {
          context.fillRect(point.x + drift - 2, point.y + 1, 6, 0.6);
          context.fillRect(point.x + drift + 1, point.y - 2, 0.6, 6);
        }
      }
      context.globalAlpha = 1;
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      // About 6,000 dots at most, with fewer on small screens.
      const spacing = Math.max(10, Math.sqrt((width * height) / 6000));
      points = [];
      for (let y = 0; y < height; y += spacing) {
        for (let x = 0; x < width; x += spacing) {
          points.push({
            x,
            y,
            u: (x / width) * 2 - 1,
            v: (y / height) * 2 - 1,
            phase: (((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1) + 1) * Math.PI,
          });
        }
      }
      paint();
    };

    const tick = (now: number) => {
      if (previous === 0) previous = now;
      const elapsed = now - previous;
      if (elapsed >= 1000 / 24) {
        time += Math.min(elapsed, 100) / 1000;
        previous = now;
        paint();
      }
      frame = window.requestAnimationFrame(tick);
    };

    const sync = () => {
      window.cancelAnimationFrame(frame);
      previous = 0;
      if (!document.hidden && !paused && !preference.matches) {
        frame = window.requestAnimationFrame(tick);
      } else {
        paint();
      }
    };
    resize();
    sync();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", sync);
    preference.addEventListener("change", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      preference.removeEventListener("change", sync);
    };
  }, [paused]);

  return (
    <>
      <canvas className="ambient-field" ref={canvasRef} aria-hidden="true" />
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
