/**
 * Upload hero media to the public Supabase Storage bucket "media" (folder hero/).
 *   node --env-file=.env.local scripts/upload-hero-media.mjs <dir-with-files>
 * Needs STORAGE_SERVER_KEY (secret key, local only). Creates/updates the bucket idempotently.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const BASE = process.env.SUPABASE_URL || "https://dsdiepxisescwjmiguoh.supabase.co";
const KEY = process.env.STORAGE_SERVER_KEY;
if (!KEY) throw new Error("STORAGE_SERVER_KEY is not set");
const dir = process.argv[2];
const headers = KEY.startsWith("eyJ") ? { apikey: KEY, Authorization: `Bearer ${KEY}` } : { apikey: KEY };
const BUCKET = {
  id: "media",
  name: "media",
  public: true,
  file_size_limit: 50 * 1024 * 1024,
  allowed_mime_types: ["video/webm", "video/mp4", "image/jpeg", "image/png", "image/webp"],
};
const TYPES = { ".webm": "video/webm", ".mp4": "video/mp4", ".jpg": "image/jpeg" };
const FILES = ["hero-1080.webm", "hero-1080.mp4", "hero-1440.webm", "hero-1440.mp4", "hero-poster.jpg"];

async function call(method, url, body, extra = {}) {
  const res = await fetch(url, { method, headers: { ...headers, ...extra }, body });
  const text = await res.text();
  return { status: res.status, text };
}

let r = await call("POST", `${BASE}/storage/v1/bucket`, JSON.stringify(BUCKET), { "Content-Type": "application/json" });
if (r.status >= 300) {
  if (/already exists|Duplicate/i.test(r.text)) {
    r = await call("PUT", `${BASE}/storage/v1/bucket/media`, JSON.stringify(BUCKET), { "Content-Type": "application/json" });
    console.log("bucket updated:", r.status);
  } else {
    console.log("bucket create failed:", r.status, r.text.slice(0, 200));
    process.exit(1);
  }
} else console.log("bucket created:", r.status);

for (const f of FILES) {
  const p = path.join(dir, f);
  const body = readFileSync(p);
  const up = await call("POST", `${BASE}/storage/v1/object/media/hero/${f}`, body, {
    "Content-Type": TYPES[path.extname(f)],
    "x-upsert": "true",
    "cache-control": "max-age=86400",
  });
  console.log(`${f}: ${(statSync(p).size / 1e6).toFixed(2)}MB → ${up.status}${up.status >= 300 ? " " + up.text.slice(0, 160) : ""}`);
}
