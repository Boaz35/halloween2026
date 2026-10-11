import { departmentLabel } from "@/config/competition";
import { getDb } from "@/db";
import { listRegistrations } from "@/server/admin";
import { getCompetition, getResultSnapshot, getRounds } from "@/server/competition";
import { getViewer } from "@/server/session";
import { listGallery } from "@/server/gallery";

/** Organizer CSV exports: registrants and aggregated results. Never individual ballots (§7.7). */
export async function GET(_req: Request, ctx: RouteContext<"/admin/export/[kind]">) {
  const v = await getViewer();
  if (!v?.isOrganizer) return new Response("Forbidden", { status: 403 });
  const { kind } = await ctx.params;
  const db = await getDb();
  const c = await getCompetition(db);
  let rows: (string | number)[][] = [];
  if (kind === "registrations") {
    const regs = await listRegistrations(db, c.id);
    rows = [["full_name", "email", "department", "avatar_id", "registered_at", "status", "submission"]];
    for (const { r, email, sub } of regs) {
      rows.push([
        r.fullName,
        email,
        departmentLabel(r.department),
        r.avatarId,
        r.registeredAt.toISOString(),
        r.withdrawnAt ? "withdrawn" : r.cancelledAt ? "cancelled" : "active",
        sub?.submittedAt ? (sub.reviewStatus ?? "pending") : sub?.id ? "draft" : "",
      ]);
    }
  } else if (kind === "results") {
    const rounds = await getRounds(db, c.id);
    const items = await listGallery(db, { userId: v.userId, isOrganizer: true }, { seed: "export" });
    const name = (id: string) => items.find((i) => i.id === id);
    rows = [["round", "submission_title", "creator", "votes", "selected", "ballots", "published_at"]];
    for (const r of [rounds.prelim, rounds.final]) {
      if (!r) continue;
      const s = await getResultSnapshot(db, r.id);
      if (!s) continue;
      for (const t of s.tallies) {
        const it = name(t.submissionId);
        rows.push([r.kind, it?.content.title ?? t.submissionId, it?.creatorName ?? "", t.votes, s.selectedSubmissionIds.includes(t.submissionId) ? "yes" : "", s.ballotCount, s.publishedAt.toISOString()]);
      }
    }
  } else {
    return new Response("Not found", { status: 404 });
  }
  // Prefix formula-like cells to prevent CSV injection in spreadsheets.
  const cell = (x: string | number) => {
    let s = String(x);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
