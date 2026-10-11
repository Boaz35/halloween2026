"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMotionPaused, subscribeMotionPaused, writeMotionPaused } from "@/lib/motionPref";

/**
 * Supplied mascot (assets/brand/zemingo-halloween-mascot.png, 1024×1536 RGBA) — docs/MASCOT_INTEGRATION.md.
 * Variant sets size and motion only; it never encodes competition state.
 * Layers: stage (glow + ground shadow) → entry wrapper (once) → ambient wrapper (loop) → image.
 * Separate wrappers so entry and loop transforms never override each other.
 */
export type MascotVariant = "hero" | "companion" | "success" | "empty" | "results";
export type MascotMotion = "ambient" | "once" | "none";

const SRC = "/brand/zemingo-halloween-mascot.png";
export function HalloweenMascot({
  variant,
  motion = "none",
  describe = false,
  className = "",
}: {
  variant: MascotVariant;
  motion?: MascotMotion;
  /** Shown on its own to explain the brand → short alt; otherwise decorative. */
  describe?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const userPaused = useSyncExternalStore(subscribeMotionPaused, readMotionPaused, () => false);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (motion !== "ambient") return;
    const el = ref.current;
    const io = el ? new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting)) : null;
    if (el && io) io.observe(el);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [motion]);

  if (failed) return null; // a failed asset never blocks the page

  const toggle = () => writeMotionPaused(!userPaused);

  return (
    <div className={`mascot mascot--${variant} ${className}`} data-motion={motion} data-paused={userPaused || offscreen || hidden || undefined} ref={ref}>
      <div className="mascot__stage">
        <div className="mascot__glow" aria-hidden />
        <div className="mascot__shadow" aria-hidden />
        <div className="mascot__entry">
          <div className="mascot__ambient">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SRC}
              width={1024}
              height={1536}
              alt={describe ? "פלמינגו־זברה של Zemingo בתחפושת דלעת" : ""}
              aria-hidden={describe ? undefined : true}
              loading={variant === "hero" ? "eager" : "lazy"}
              fetchPriority={variant === "hero" ? "high" : undefined}
              decoding="async"
              className="mascot__img"
              onError={() => setFailed(true)}
            />
          </div>
        </div>
      </div>
      {motion === "ambient" && (
        <button type="button" className="mascot__toggle btn btn-ghost btn-sm" onClick={toggle} aria-pressed={userPaused}>
          {userPaused ? "▶ הפעלת אנימציה" : "❚❚ עצירת אנימציה"}
        </button>
      )}
    </div>
  );
}
