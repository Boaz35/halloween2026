/**
 * Pure counting logic (§7.6). No ordering by record order or name — ties crossing the
 * boundary are returned for an organizer decision.
 */
export type Tally = { submissionId: string; votes: number };

export type Selection =
  | { status: "no_votes" }
  | { status: "resolved"; selected: string[] }
  | { status: "tie"; clear: string[]; tieGroup: string[]; remainingSlots: number; boundaryVotes: number };

export function computeSelection(tallies: Tally[], slots: number): Selection {
  const total = tallies.reduce((s, t) => s + t.votes, 0);
  if (total === 0) return { status: "no_votes" };
  if (tallies.length <= slots) return { status: "resolved", selected: tallies.map((t) => t.submissionId) };
  const sorted = [...tallies].sort((a, b) => b.votes - a.votes);
  const boundary = sorted[slots - 1].votes;
  const clear = sorted.filter((t) => t.votes > boundary).map((t) => t.submissionId);
  const group = sorted.filter((t) => t.votes === boundary).map((t) => t.submissionId);
  const remaining = slots - clear.length;
  if (group.length === remaining) return { status: "resolved", selected: [...clear, ...group] };
  return { status: "tie", clear, tieGroup: group, remainingSlots: remaining, boundaryVotes: boundary };
}

/** Stable per-viewer pseudo-random order (§7.4), so the first card gets no fixed advantage. */
export function stableShuffle<T>(items: T[], key: (t: T) => string, seed: string): T[] {
  const h = (s: string) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return x >>> 0;
  };
  return [...items]
    .map((t) => ({ t, k: h(seed + "|" + key(t)) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t);
}
