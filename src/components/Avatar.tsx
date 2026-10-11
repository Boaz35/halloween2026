"use client";

import Image from "next/image";
import { useState } from "react";
import { AVATAR_PLACEHOLDERS, getAvatar } from "@/config/competition";

/**
 * Avatar by stable catalog id (assets/avatars/catalog.json). Round 1:1 portrait, object-fit cover,
 * no extra zoom (assets/avatars/source/README.md). Served through next/image so each use gets a
 * resized file instead of the 1254px source. If the image is missing or fails to load, a labeled
 * placeholder with the same id is shown — selection and saved registrations never depend on the art.
 * The selection ring and ✓ belong to the surrounding card, not to the image.
 */
export function Avatar({
  id,
  size = 40,
  decorative = false,
  className = "",
  sizes,
}: {
  id: string;
  size?: number;
  decorative?: boolean;
  className?: string;
  /** next/image `sizes` when CSS changes the rendered size per breakpoint */
  sizes?: string;
}) {
  const a = getAvatar(id);
  const [failed, setFailed] = useState(false);
  const label = a?.labelHe ?? "אווטר";
  const ph = AVATAR_PLACEHOLDERS[id];
  const box = { width: size, height: size };

  if (a?.publicPath && !failed) {
    return (
      <Image
        src={a.publicPath}
        alt={decorative ? "" : label}
        width={size}
        height={size}
        sizes={sizes ?? `${size}px`}
        className={`avatar shrink-0 ${className}`}
        style={box}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={`avatar inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ ...box, background: ph?.bg ?? "#1F1D17", fontSize: Math.round(size * 0.5), lineHeight: 1 }}
    >
      {ph?.glyph ?? label.slice(0, 1)}
    </span>
  );
}
