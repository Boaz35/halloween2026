"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMotionPaused, subscribeMotionPaused, writeMotionPaused } from "@/lib/motionPref";

/**
 * Full-width hero background video (opaque 16:9 scene, seamless 9.3s loop).
 * Desktop: covers the whole hero behind the text, framed so the flamingo sits left of centre and a
 * shade keeps the right-hand text readable. Mobile: a full-bleed 16:9 strip under the text and CTA.
 *
 * Muted, no controls, decorative (aria-hidden). The still poster shows until the video plays, and
 * stays if autoplay is blocked, the file fails, or the viewer prefers reduced motion. A visible
 * pause button (required for >5s autoplay, WCAG 2.2.2) shares the hero pause preference with the
 * headline; an off-screen hero or hidden tab also pauses it.
 */
const POSTER = "/brand/hero-loop-poster.jpg";
const REDUCED = "(prefers-reduced-motion: reduce)";
const reducedSnapshot = () => window.matchMedia(REDUCED).matches;
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function HeroVideo() {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPaused = useSyncExternalStore(subscribeMotionPaused, readMotionPaused, () => false);
  // Server snapshot "true": render the poster only until the client knows the preference.
  const reduced = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => true);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const paused = userPaused || offscreen || hidden;
  const useVideo = !reduced && !failed;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !useVideo) return;
    if (paused) v.pause();
    else v.play().catch(() => setPlaying(false)); // autoplay blocked → poster stays
  }, [paused, useVideo]);

  return (
    <div ref={ref} className="hero-video" data-playing={playing || undefined}>
      <div className="hero-video__frame" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero-video__media hero-video__poster" src={POSTER} alt="" width={1920} height={1080} fetchPriority="high" />
        {useVideo && (
          <video
            ref={videoRef}
            className="hero-video__media hero-video__video"
            muted
            loop
            playsInline
            preload="auto"
            poster={POSTER}
            tabIndex={-1}
            disablePictureInPicture
            onPlaying={() => setPlaying(true)}
            onError={() => setFailed(true)}
          >
            <source src="/brand/hero-loop.webm" type="video/webm" />
            <source src="/brand/hero-loop.mp4" type="video/mp4" />
          </video>
        )}
        <div className="hero-video__shade" />
      </div>
      {!reduced && (
        <button type="button" className="hero-video__toggle btn btn-ghost btn-sm" onClick={() => writeMotionPaused(!userPaused)} aria-pressed={userPaused}>
          {userPaused ? "▶ הפעלת אנימציה" : "❚❚ עצירת אנימציה"}
        </button>
      )}
    </div>
  );
}
