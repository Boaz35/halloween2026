import { COVER_MAX_BYTES } from "@/config/competition";
import { AppError } from "./errors";

/** Detect image type by magic bytes — the client-declared type is not trusted. No SVG (script risk), no GIF (TECHNICAL_SPEC §7). */
export function sniffImageMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export function validateCover(bytes: Uint8Array): string {
  if (bytes.length === 0) throw new AppError("לא נבחר קובץ.");
  if (bytes.length > COVER_MAX_BYTES) throw new AppError("התמונה גדולה מדי (עד 4MB).");
  const mime = sniffImageMime(bytes);
  if (!mime) throw new AppError("סוג קובץ לא נתמך. אפשר להעלות JPG, PNG או WebP.");
  return mime;
}
