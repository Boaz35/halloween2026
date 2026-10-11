"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMotionPaused, subscribeMotionPaused } from "@/lib/motionPref";

/**
 * Hero headline: flickers like a dying fluorescent tube, fades into the dark, and comes back on a
 * loop (CSS `headline-tube`, 10s). A flashlight that follows the pointer over the hero lights the
 * letters — including while the headline is dark.
 *
 * Safety: the keyframes keep to ≤3 flashes in any one second (WCAG 2.3.1). prefers-reduced-motion,
 * the shared hero pause button, an off-screen hero or a hidden tab all stop the loop; when stopped
 * by preference the headline stays fully lit. The torch layer is aria-hidden; the real text is the
 * base layer, so screen readers read it once and are unaffected by the animation.
 */
export function HeroHeadline({ id, lines, className = "" }: { id: string; lines: string[]; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const userPaused = useSyncExternalStore(subscribeMotionPaused, readMotionPaused, () => false);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const h = ref.current;
    if (!h) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(h);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);

    // Flashlight: pointer devices only. Tracks the whole hero so the beam can "find" the text.
    const area = h.closest("section") ?? h;
    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const r = h.getBoundingClientRect();
      h.style.setProperty("--hx", `${px - r.left}px`);
      h.style.setProperty("--hy", `${py - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      px = e.clientX;
      py = e.clientY;
      h.dataset.torch = "on";
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      delete h.dataset.torch;
    };
    const canHover = window.matchMedia("(hover: hover)").matches;
    if (canHover) {
      area.addEventListener("pointermove", onMove as EventListener);
      area.addEventListener("pointerleave", onLeave);
    }
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      if (canHover) {
        area.removeEventListener("pointermove", onMove as EventListener);
        area.removeEventListener("pointerleave", onLeave);
      }
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const text = lines.map((l, i) => (
    <span key={i} className="block">
      {l}
    </span>
  ));

  return (
    <h1
      id={id}
      ref={ref}
      className={`headline ${className}`}
      data-motion={userPaused ? "off" : "loop"}
      data-paused={offscreen || hidden || undefined}
    >
      <span className="headline__tube">{text}</span>
      <span className="headline__torch" aria-hidden="true">
        {text}
      </span>
    </h1>
  );
}
