import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { canViewMedia } from "@/server/gallery";
import { getViewer } from "@/server/session";

/** Cover images are served only through permission checks (§10). */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[id]">) {
  const { id } = await ctx.params;
  const v = await getViewer();
  if (!v) return new Response("Unauthorized", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const db = await getDb();
  const [m] = await db.select().from(media).where(eq(media.id, id));
  if (!m || !(await canViewMedia(db, v, m.id, m.ownerUserId))) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(m.data), {
    headers: {
      "Content-Type": m.mime,
      "Content-Length": String(m.size),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
