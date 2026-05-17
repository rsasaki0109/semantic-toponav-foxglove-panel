import type { ConflictExplanation, ReasonCode } from "./types";

// View model for the ConflictsPanel. Conflicts arrive in publisher
// order; the panel renders them grouped by reason_code then by
// blocked_agent_id so adjacent rows are diagnostically related.
export interface ConflictsView {
  rows: ConflictExplanation[];
  byReason: Record<ReasonCode, number>;
  total: number;
}

const REASON_CODES: ReasonCode[] = [
  "ok",
  "no_path",
  "deadline_miss",
  "reservation_conflict",
  "policy_rejected",
];

export function buildConflictsView(conflicts: ConflictExplanation[]): ConflictsView {
  const sorted = [...conflicts].sort((a, b) => {
    const r = a.reason_code.localeCompare(b.reason_code);
    if (r !== 0) {
      return r;
    }
    return a.blocked_agent_id.localeCompare(b.blocked_agent_id);
  });

  const byReason = Object.fromEntries(REASON_CODES.map((r) => [r, 0])) as Record<
    ReasonCode,
    number
  >;
  for (const c of sorted) {
    byReason[c.reason_code] += 1;
  }

  return { rows: sorted, byReason, total: sorted.length };
}

// The wire shape on /conflict_explanations can arrive in two forms:
//   - a JSON array of ConflictExplanation records (the bnb scheduler
//     emits one per blocked agent; bridges typically batch them);
//   - a single ConflictExplanation object (a bridge that mirrors one
//     conflict per message — happens with rosbridge JSON converters).
// Anything else is rejected so the panel can surface a parse error
// rather than rendering garbage.
export function normalizeConflicts(raw: unknown): ConflictExplanation[] {
  if (Array.isArray(raw)) {
    return raw as ConflictExplanation[];
  }
  if (raw && typeof raw === "object" && "blocked_agent_id" in raw) {
    return [raw as ConflictExplanation];
  }
  throw new Error(
    "payload is neither a ConflictExplanation nor an array of them",
  );
}
