import type { DB } from "@/db";
import { auditEvents } from "@/db/schema";

export async function audit(
  db: Pick<DB, "insert">,
  e: { actorUserId?: string | null; action: string; entityType?: string; entityId?: string; details?: Record<string, unknown> },
) {
  await db.insert(auditEvents).values({
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    entityType: e.entityType ?? null,
    entityId: e.entityId ?? null,
    details: e.details ?? null,
  });
}
