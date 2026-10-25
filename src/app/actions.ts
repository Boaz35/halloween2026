"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { TIME_ZONE } from "@/config/competition";
import { getDb } from "@/db";
import { zonedTimeToUtc } from "@/lib/time";
import { serverNow } from "@/server/clock";
import { publishGallery, recordPrelimOverride, setRegistrationCloseTime } from "@/server/competition";
import { AppError, runAction, type ActionResult } from "@/server/errors";
import { cancelRegistration, register, registerLateException, updateRegistrationProfile, withdraw } from "@/server/registration";
import { requireOrganizerAction, requireViewerAction } from "@/server/session";
import { grantLateEdit, REVIEW_STATUSES, reviewSubmission, saveDraft, submit, uploadCover, type ReviewStatus } from "@/server/submission";
import { chooseViewOnly } from "@/server/users";
import {
  castBallot,
  closeRound,
  getMyBallot,
  openRound,
  prepareRound,
  publishResults,
  recordTieDecision,
  setRoundCloseTime,
} from "@/server/voting";

type Prev = ActionResult<unknown> | null;
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const parseLocal = (v: string) => (v ? zonedTimeToUtc(v, TIME_ZONE) : null);
const refreshAll = () => revalidatePath("/", "layout");

// ── Auth ──
export async function signInGoogle() {
  await signIn("google", { redirectTo: "/" });
}
export async function signInDev(fd: FormData) {
  await signIn("dev-login", { email: str(fd, "email"), name: str(fd, "name"), redirectTo: "/" });
}
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// ── Registration ──
/** Returns a result (no server redirect) so the client can keep the form on network failure and navigate on success. */
export async function joinAction(_: Prev, fd: FormData) {
  const res = await runAction(async () => {
    const v = await requireViewerAction();
    const db = await getDb();
    const raw = { fullName: str(fd, "fullName"), department: fd.get("department") ?? undefined, avatarId: fd.get("avatarId") ?? undefined };
    const r = await register(db, v.userId, raw, serverNow);
    return { message: r.created ? "נרשמת לתחרות!" : "כבר רשומים — הפרטים הקיימים נשמרו ללא שינוי." };
  });
  // No revalidation here: the client navigates to the success view and refreshes the header there.
  // (Revalidating /join would redirect an active registrant to /me before the success view.)
  return res;
}

export async function updateProfileAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireViewerAction();
    const db = await getDb();
    await updateRegistrationProfile(
      db,
      v.userId,
      { fullName: str(fd, "fullName"), department: fd.get("department") ?? undefined, avatarId: fd.get("avatarId") ?? undefined },
      serverNow(),
    );
    refreshAll();
    return { message: "הפרטים עודכנו." };
  });
}

export async function viewOnlyAction() {
  const v = await requireViewerAction();
  const db = await getDb();
  await chooseViewOnly(db, v.userId, serverNow());
  refreshAll();
  redirect("/");
}

export async function cancelRegistrationAction() {
  return runAction(async () => {
    const v = await requireViewerAction();
    await cancelRegistration(await getDb(), v.userId, serverNow);
    refreshAll();
    return { message: "ההרשמה בוטלה." };
  });
}

export async function withdrawSelfAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireViewerAction();
    await withdraw(await getDb(), v.userId, v.userId, str(fd, "reason") || null, serverNow);
    refreshAll();
    return { message: "פרשת מהתחרות." };
  });
}

// ── Submission ──
function draftFromForm(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    mediaType: str(fd, "mediaType"),
    mediaTypeOther: str(fd, "mediaTypeOther"),
    linkUrl: str(fd, "linkUrl"),
    videoUrl: str(fd, "videoUrl"),
    requiresSpecialAccess: fd.get("requiresSpecialAccess") === "on",
    instructions: str(fd, "instructions"),
    tools: str(fd, "tools"),
  };
}

export async function saveSubmissionAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireViewerAction();
    const db = await getDb();
    const now = serverNow();
    const intent = str(fd, "intent");
    const file = fd.get("cover");
    if (file instanceof File && file.size > 0) {
      await uploadCover(db, v.userId, new Uint8Array(await file.arrayBuffer()), now);
    }
    await saveDraft(db, v.userId, draftFromForm(fd), now);
    if (intent === "submit") {
      await submit(db, v.userId, now);
      refreshAll();
      return { message: "התוצר הוגש! אפשר להמשיך לערוך ולהגיש מחדש עד הדדליין." };
    }
    refreshAll();
    return { message: "הטיוטה נשמרה. טיוטה אינה נחשבת הגשה." };
  });
}

// ── Voting ──
export async function castBallotAction(roundId: string, choiceIds: string[], expectedVersion: number) {
  const v = await requireViewerAction().catch(() => null);
  if (!v) return { ok: false as const, error: "יש להתחבר מחדש." };
  const db = await getDb();
  const res = await runAction(async () => {
    const b = await castBallot(db, v.userId, roundId, choiceIds, serverNow, expectedVersion);
    return {
      message: b.choices.length ? "ההצבעה נשמרה." : "ההצבעה בוטלה.",
      data: { choices: b.choices, updatedAt: b.updatedAt?.toISOString() ?? null, version: b.version },
    };
  });
  if (!res.ok) {
    // Always hand back the server-confirmed ballot so the UI never shows a false "saved" state.
    const cur = await getMyBallot(db, v.userId, roundId);
    return { ...res, current: { choices: cur.choices, updatedAt: cur.updatedAt?.toISOString() ?? null, version: cur.version } };
  }
  return res;
}

// ── Organizer ──
export async function setRegistrationCloseAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const t = parseLocal(str(fd, "registrationClosesAt"));
    if (!t) throw new AppError("יש לבחור מועד.");
    await setRegistrationCloseTime(await getDb(), v.userId, t, serverNow());
    refreshAll();
    return { message: "מועד סגירת ההרשמה עודכן ונרשם ביומן." };
  });
}

export async function publishGalleryAction() {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    await publishGallery(await getDb(), v.userId, serverNow());
    refreshAll();
    return { message: "הגלריה פורסמה." };
  });
}

export async function prelimOverrideAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    await recordPrelimOverride(await getDb(), v.userId, str(fd, "reason"), serverNow());
    refreshAll();
    return { message: "החריג נרשם — הגמר ייפתח עם כל התוצרים התקינים." };
  });
}

export async function reviewAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const status = str(fd, "status") as ReviewStatus;
    if (!REVIEW_STATUSES.includes(status)) throw new AppError("סטטוס לא תקין.");
    await reviewSubmission(await getDb(), v.userId, str(fd, "submissionId"), status, str(fd, "note") || null, serverNow());
    refreshAll();
    return { message: "הסטטוס עודכן." };
  });
}

export async function lateEditAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const until = parseLocal(str(fd, "until"));
    if (!until) throw new AppError("יש לבחור מועד.");
    await grantLateEdit(await getDb(), v.userId, str(fd, "submissionId"), until, str(fd, "reason"), serverNow());
    refreshAll();
    return { message: "חריג העריכה נרשם." };
  });
}

export async function organizerWithdrawAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const reason = str(fd, "reason").trim();
    if (reason.length < 3) throw new AppError("יש לרשום נימוק.");
    await withdraw(await getDb(), v.userId, str(fd, "userId"), reason, serverNow);
    refreshAll();
    return { message: "הפרישה נרשמה." };
  });
}

/** C20 — organizer-recorded late registration (after the close, before the submission deadline). */
export async function lateRegistrationAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const profile = { fullName: str(fd, "fullName"), department: str(fd, "department"), avatarId: str(fd, "avatarId") };
    const r = await registerLateException(await getDb(), v.userId, str(fd, "email"), profile, str(fd, "reason"), serverNow);
    refreshAll();
    return { message: `${r.fullName} נרשם/ה כחריג. אפשר להיכנס ל"התוצר שלי" ולהגיש עד הדדליין.` };
  });
}

export async function prepareRoundAction() {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const r = await prepareRound(await getDb(), v.userId, serverNow());
    refreshAll();
    return { message: r.warning ? `הסבב הוכן. שימו לב: ${r.warning}` : "הסבב הוכן ורשימת המועמדים ננעלה." };
  });
}

export async function openRoundAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    await openRound(await getDb(), v.userId, str(fd, "roundId"), parseLocal(str(fd, "closesAt")), serverNow());
    refreshAll();
    return { message: "ההצבעה נפתחה." };
  });
}

export async function setCloseTimeAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    await setRoundCloseTime(await getDb(), v.userId, str(fd, "roundId"), parseLocal(str(fd, "closesAt")), serverNow());
    refreshAll();
    return { message: "מועד הסגירה עודכן." };
  });
}

export async function closeRoundAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    await closeRound(await getDb(), v.userId, str(fd, "roundId"), serverNow);
    refreshAll();
    return { message: "הסבב ננעל." };
  });
}

export async function tieDecisionAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const selected = fd.getAll("selected").filter((x): x is string => typeof x === "string");
    await recordTieDecision(await getDb(), v.userId, str(fd, "roundId"), selected, str(fd, "reason"), serverNow());
    refreshAll();
    return { message: "ההכרעה נרשמה." };
  });
}

export async function publishResultsAction(_: Prev, fd: FormData) {
  return runAction(async () => {
    const v = await requireOrganizerAction();
    const r = await publishResults(await getDb(), v.userId, str(fd, "roundId"), serverNow());
    refreshAll();
    return { message: r.alreadyPublished ? "התוצאות כבר פורסמו — לא בוצע שינוי." : "התוצאות פורסמו." };
  });
}
