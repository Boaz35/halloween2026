"use client";

import { useEffect, useRef } from "react";

/**
 * The hero's dark wall (docs/DESIGN.md v2.0). A soft light follows the pointer and reveals
 * the competition rules scrawled on the wall. Purely decorative: aria-hidden, no pointer events,
 * every rule here is also stated in plain text on the page. Touch devices get a static light
 * resting on the mascot; nothing animates on its own, so reduced motion needs no special case.
 */
// Centre of each note in % of the hero; m = position on phones (others are desktop-only).
const NOTES: { text: string; x: number; y: number; r: number; m?: [number, number] }[] = [
  { text: "אף אחד לא רואה את הקולות לפני הפרסום. אף אחד.", x: 57, y: 5, r: -2 },
  { text: "אי אפשר להצביע לעצמך. מישהו כבר ניסה.", x: 91, y: 20, r: 2.5, m: [78, 63] },
  { text: "אחרי הדדליין הדלת ננעלת", x: 62, y: 50, r: -3, m: [22, 72] },
  { text: "תוצר אחד. אדם אחד.", x: 92, y: 52, r: 1.5 },
  { text: "שמרת? בטוח ששמרת?", x: 58, y: 80, r: 2, m: [80, 90] },
  { text: "הטיוטה שלך עדיין כאן", x: 91, y: 84, r: -1.5, m: [20, 94] },
  { text: "גם מי שלא מתחרה מצביע", x: 13, y: 5, r: 1.5 },
  { text: "רק חמישה ימשיכו מכאן", x: 6, y: 60, r: -2 },
];

export function HeroWall() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wall = ref.current;
    const hero = wall?.parentElement;
    if (!wall || !hero) return;
    if (window.matchMedia("(hover: none)").matches) return; // touch: static light on the mascot

    let frame = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      frame = 0;
      const r = wall.getBoundingClientRect();
      wall.style.setProperty("--x", `${px - r.left}px`);
      wall.style.setProperty("--y", `${py - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    hero.addEventListener("pointermove", onMove);
    return () => {
      hero.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="hero__wall" aria-hidden="true">
      <div className="hero__beam" />
      <div className="hero__writing">
        {NOTES.map((n) => (
          <span
            key={n.text}
            className="hero__note"
            data-mobile={n.m ? "" : undefined}
            style={
              {
                "--nx": `${n.x}%`,
                "--ny": `${n.y}%`,
                "--nr": `${n.r}deg`,
                "--mx": n.m ? `${n.m[0]}%` : undefined,
                "--my": n.m ? `${n.m[1]}%` : undefined,
              } as React.CSSProperties
            }
          >
            {n.text}
          </span>
        ))}
      </div>
      <div className="hero__vignette" />
    </div>
  );
}
