"use client";

/**
 * Per-viewer "pause animation" preference for the hero (mascot + headline).
 * Browser storage is a convenience only; failures fall back to "not paused".
 */
const KEY = "mascot-motion-paused";
const EVENT = "mascot-pause-change";

export function readMotionPaused() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMotionPaused(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeMotionPaused(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
