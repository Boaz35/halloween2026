"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { readMotionPaused, subscribeMotionPaused, writeMotionPaused } from "@/lib/motionPref";

/**
 * Full-width hero background video (opaque 16:9 scene, seamless 9.3s loop).
 * Desktop: covers the whole hero behind the text, framed so the flamingo sits left of centre and a
 * shade keeps the right-hand text readable. Mobile: a full-bleed 16:9 strip under the text and CTA.
 *
 * No controls, decorative (aria-hidden). The still poster shows until the video plays, and
 * stays if autoplay is blocked, the file fails, or the viewer prefers reduced motion. A visible
 * pause button (required for >5s autoplay, WCAG 2.2.2) shares the hero pause preference with the
 * headline; an off-screen hero or hidden tab also pauses it.
 *
 * Sound: browsers only autoplay muted, so the loop starts muted and is unmuted on the viewer's
 * first interaction anywhere on the page (pointer or key — a user activation), unless they muted
 * it before. A visible sound toggle (WCAG 1.4.2) stores the choice per browser.
 */
const POSTER = "/brand/hero-loop-poster.jpg";
const VOLUME = 0.8;
const SOUND_KEY = "hero-sound"; // "off" = viewer muted it; anything else = unmute on first interaction
const SOUND_EVENT = "hero-sound-change";
function readSoundOff() {
  try {
    return localStorage.getItem(SOUND_KEY) === "off";
  } catch {
    return false;
  }
}
function writeSoundOff(off: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, off ? "off" : "on");
  } catch {}
  window.dispatchEvent(new Event(SOUND_EVENT));
}
function subscribeSound(cb: () => void) {
  window.addEventListener(SOUND_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(SOUND_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
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
  const soundOff = useSyncExternalStore(subscribeSound, readSoundOff, () => false);
  // True once the page has had a user activation, so the browser allows audio.
  const [activated, setActivated] = useState(false);
  const audible = activated && !soundOff;
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

  // First interaction anywhere unlocks audio. Must unmute synchronously inside the event handler
  // (user activation). The sound toggle handles its own clicks, so it is ignored here.
  useEffect(() => {
    if (!useVideo || activated) return;
    const onFirst = (e: Event) => {
      if ((e.target as Element | null)?.closest?.("[data-sound-toggle]")) return;
      const v = videoRef.current;
      if (v && !readSoundOff()) {
        v.muted = false;
        v.volume = VOLUME;
        if (v.paused && !paused) v.play().catch(() => {});
      }
      setActivated(true);
    };
    const opts = { capture: true } as const;
    window.addEventListener("pointerdown", onFirst, opts);
    window.addEventListener("keydown", onFirst, opts);
    return () => {
      window.removeEventListener("pointerdown", onFirst, opts);
      window.removeEventListener("keydown", onFirst, opts);
    };
  }, [useVideo, activated, paused]);

  // Keep the element in sync with the preference (e.g. toggled in another tab).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !audible;
    if (audible) v.volume = VOLUME;
  }, [audible]);

  const toggleSound = () => {
    const v = videoRef.current;
    const turnOn = !audible;
    if (v) {
      v.muted = !turnOn; // inside the click → counts as user activation
      if (turnOn) {
        v.volume = VOLUME;
        if (v.paused && !paused) v.play().catch(() => {});
      }
    }
    setActivated(true);
    writeSoundOff(!turnOn);
  };

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
        <div className="hero-video__controls">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => writeMotionPaused(!userPaused)} aria-pressed={userPaused}>
            {userPaused ? "▶ הפעלת אנימציה" : "❚❚ עצירת אנימציה"}
          </button>
          {useVideo && (
            <button type="button" className="btn btn-ghost btn-sm" data-sound-toggle onClick={toggleSound} aria-pressed={audible}>
              {audible ? "🔊 השתקה" : "🔇 הפעלת סאונד"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
