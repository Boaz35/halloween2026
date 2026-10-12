"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMotionPaused, subscribeMotionPaused, writeMotionPaused } from "@/lib/motionPref";

/**
 * Supplied mascot (assets/brand/zemingo-halloween-mascot.png, 1024×1536 RGBA) — docs/MASCOT_INTEGRATION.md.
 * Variant sets size and motion only; it never encodes competition state.
 * Layers: stage (glow + ground shadow) → entry wrapper (once) → ambient wrapper (loop) → image.
 * Separate wrappers so entry and loop transforms never override each other.
 *
 * `video` (hero only): the supplied 6s alpha loop (MASCOT_INTEGRATION.md "לולאת וידאו"). The still
 * poster (the loop's first frame) renders first and stays if autoplay is blocked, the video fails,
 * motion is paused or reduced. Safari/iOS get HEVC-with-alpha, everyone else VP9-alpha WebM —
 * each engine shows the other's alpha as a black box, so the source is chosen per engine.
 */
export type MascotVariant = "hero" | "companion" | "success" | "empty" | "results";
export type MascotMotion = "ambient" | "once" | "none";

const SRC = "/brand/zemingo-halloween-mascot.png";
const LOOP_POSTER = "/brand/mascot-loop-poster.png";
const LOOP_WEBM = "/brand/mascot-loop.webm";
const LOOP_HEVC = "/brand/mascot-loop-hevc.mov";

/** WebKit engines (Safari, every iOS browser) play HEVC alpha but not VP9 alpha; Blink/Gecko the reverse. */
function pickLoopSource() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  const macSafari = /Macintosh/.test(ua) && /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  return ios || macSafari ? LOOP_HEVC : LOOP_WEBM;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
/** Loop source for this browser, or null on the server / with reduced motion (poster only). */
function loopSourceSnapshot() {
  return window.matchMedia(REDUCED).matches ? null : pickLoopSource();
}
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export function HalloweenMascot({
  variant,
  motion = "none",
  describe = false,
  className = "",
  video = false,
}: {
  variant: MascotVariant;
  motion?: MascotMotion;
  /** Shown on its own to explain the brand → short alt; otherwise decorative. */
  describe?: boolean;
  className?: string;
  /** Play the alpha video loop instead of CSS sway (hero only). */
  video?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const userPaused = useSyncExternalStore(subscribeMotionPaused, readMotionPaused, () => false);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientSrc = useSyncExternalStore(subscribeReducedMotion, loopSourceSnapshot, () => null);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoSrc = video && !videoFailed ? clientSrc : null;
  const [playing, setPlaying] = useState(false);
  const paused = userPaused || offscreen || hidden;

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

  // Play/pause follows the shared pause preference, visibility and tab state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    if (paused) {
      v.pause();
      return;
    }
    v.play().catch(() => setPlaying(false)); // autoplay blocked → poster stays
  }, [paused, videoSrc]);

  if (failed) return null; // a failed asset never blocks the page

  const toggle = () => writeMotionPaused(!userPaused);

  return (
    <div
      className={`mascot mascot--${variant} ${className}`}
      data-motion={motion}
      data-paused={paused || undefined}
      data-video={playing ? "playing" : video ? "poster" : undefined}
      ref={ref}
    >
      <div className="mascot__stage">
        <div className="mascot__glow" aria-hidden />
        <div className="mascot__shadow" aria-hidden />
        <div className="mascot__entry">
          <div className="mascot__ambient">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video ? LOOP_POSTER : SRC}
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
            {videoSrc && (
              <video
                ref={videoRef}
                className="mascot__video"
                src={videoSrc}
                width={720}
                height={1080}
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden
                tabIndex={-1}
                disablePictureInPicture
                onPlaying={() => setPlaying(true)}
                onError={() => {
                  setPlaying(false);
                  setVideoFailed(true);
                }}
              />
            )}
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
