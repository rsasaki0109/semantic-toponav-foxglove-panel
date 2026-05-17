import { buildConflictsView, normalizeConflicts } from "../conflicts";
import type { ConflictExplanation } from "../types";

function mk(
  blocked_agent_id: string,
  reason_code: ConflictExplanation["reason_code"],
  extra: Partial<ConflictExplanation> = {},
): ConflictExplanation {
  return {
    blocked_agent_id,
    reason_code,
    blocking_agents: [],
    blocking_resources: [],
    detail: "",
    ...extra,
  };
}

describe("buildConflictsView", () => {
  it("returns zeroed counters and an empty row set when given nothing", () => {
    const view = buildConflictsView([]);
    expect(view.rows).toEqual([]);
    expect(view.total).toBe(0);
    expect(view.byReason).toEqual({
      ok: 0,
      no_path: 0,
      deadline_miss: 0,
      reservation_conflict: 0,
      policy_rejected: 0,
    });
  });

  it("sorts by reason_code then by blocked_agent_id", () => {
    const view = buildConflictsView([
      mk("zeta", "reservation_conflict"),
      mk("alpha", "no_path"),
      mk("beta", "reservation_conflict"),
      mk("alpha", "policy_rejected"),
    ]);
    expect(view.rows.map((r) => `${r.reason_code}:${r.blocked_agent_id}`)).toEqual([
      "no_path:alpha",
      "policy_rejected:alpha",
      "reservation_conflict:beta",
      "reservation_conflict:zeta",
    ]);
  });

  it("counts by reason_code", () => {
    const view = buildConflictsView([
      mk("a", "reservation_conflict"),
      mk("b", "reservation_conflict"),
      mk("c", "deadline_miss"),
    ]);
    expect(view.total).toBe(3);
    expect(view.byReason.reservation_conflict).toBe(2);
    expect(view.byReason.deadline_miss).toBe(1);
    expect(view.byReason.no_path).toBe(0);
  });
});

describe("normalizeConflicts", () => {
  it("accepts arrays as-is", () => {
    const arr = [mk("a", "no_path"), mk("b", "reservation_conflict")];
    expect(normalizeConflicts(arr)).toEqual(arr);
  });

  it("wraps a single ConflictExplanation in a one-element array", () => {
    const one = mk("alpha", "reservation_conflict", {
      blocking_agents: ["bravo"],
      blocking_resources: ["edge:a-b"],
      detail: "alpha was blocked by bravo on edge:a-b",
    });
    expect(normalizeConflicts(one)).toEqual([one]);
  });

  it("rejects anything that is neither an array nor a ConflictExplanation", () => {
    expect(() => normalizeConflicts(null)).toThrow();
    expect(() => normalizeConflicts("not a conflict")).toThrow();
    expect(() => normalizeConflicts({ foo: "bar" })).toThrow();
  });
});
