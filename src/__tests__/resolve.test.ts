import {
  buildResolveView,
  clarificationRows,
  normalizeResolveTrace,
} from "../resolve";
import type { GoalCandidate, ResolveTrace } from "../types";

function cand(
  node_id: string,
  score: number,
  reasons: string[] = [],
): GoalCandidate {
  return { node_id, score, reasons };
}

function trace(extra: Partial<ResolveTrace> = {}): ResolveTrace {
  return {
    query: "the meeting room near the kitchen",
    candidates: [],
    base_candidates: [],
    llm_pick: null,
    llm_reason: null,
    raw_response: "",
    used_fallback: false,
    embedding_scores: {},
    clarification: null,
    ...extra,
  };
}

describe("buildResolveView", () => {
  it("reports no_pick when the LLM never picked and there is no clarification", () => {
    const view = buildResolveView(trace());
    expect(view.pickStatus).toBe("no_pick");
    expect(view.rows).toEqual([]);
    expect(view.hasEmbeddingScores).toBe(false);
  });

  it("reports llm_pick and flags the picked row when the LLM picked from-pool", () => {
    const view = buildResolveView(
      trace({
        candidates: [cand("room_b", 0.7), cand("room_a", 0.6)],
        base_candidates: [cand("room_a", 0.6), cand("room_b", 0.7)],
        llm_pick: "room_b",
        llm_reason: "room_b is adjacent to the kitchen",
      }),
    );
    expect(view.pickStatus).toBe("llm_pick");
    expect(view.rows.map((r) => `${r.rank}:${r.node_id}:${r.base_rank}`)).toEqual([
      "1:room_b:2",
      "2:room_a:1",
    ]);
    expect(view.rows[0]!.is_llm_pick).toBe(true);
    expect(view.rows[1]!.is_llm_pick).toBe(false);
    expect(view.llm_reason).toBe("room_b is adjacent to the kitchen");
  });

  it("reports fallback when the LLM pick was rejected and the deterministic order was kept", () => {
    const view = buildResolveView(
      trace({
        candidates: [cand("room_a", 0.6), cand("room_b", 0.7)],
        base_candidates: [cand("room_a", 0.6), cand("room_b", 0.7)],
        llm_pick: null,
        used_fallback: true,
      }),
    );
    expect(view.pickStatus).toBe("fallback");
    expect(view.rows.every((r) => !r.is_llm_pick)).toBe(true);
  });

  it("reports clarification_pending whenever a clarification is present, even if the LLM also picked", () => {
    const view = buildResolveView(
      trace({
        candidates: [cand("room_a", 0.5), cand("room_b", 0.5)],
        base_candidates: [cand("room_a", 0.5), cand("room_b", 0.5)],
        llm_pick: "room_a",
        clarification: {
          question: "Did you mean room_a or room_b?",
          candidates: [cand("room_a", 0.5), cand("room_b", 0.5)],
        },
      }),
    );
    expect(view.pickStatus).toBe("clarification_pending");
    expect(view.clarification).not.toBeNull();
  });

  it("attaches embedding_score per row when the resolver supplied one", () => {
    const view = buildResolveView(
      trace({
        candidates: [cand("room_a", 0.6), cand("room_b", 0.4)],
        base_candidates: [cand("room_a", 0.6), cand("room_b", 0.4)],
        embedding_scores: { room_a: 0.81, room_b: 0.42 },
      }),
    );
    expect(view.hasEmbeddingScores).toBe(true);
    expect(view.rows[0]!.embedding_score).toBeCloseTo(0.81);
    expect(view.rows[1]!.embedding_score).toBeCloseTo(0.42);
  });

  it("leaves embedding_score null when only some candidates carry one", () => {
    const view = buildResolveView(
      trace({
        candidates: [cand("room_a", 0.6), cand("room_b", 0.4)],
        base_candidates: [cand("room_a", 0.6), cand("room_b", 0.4)],
        embedding_scores: { room_a: 0.81 },
      }),
    );
    expect(view.rows[0]!.embedding_score).toBeCloseTo(0.81);
    expect(view.rows[1]!.embedding_score).toBeNull();
  });

  it("leaves base_rank null when a final candidate is not in base_candidates", () => {
    // Shouldn't happen in practice — the LLM reorders the deterministic
    // pool — but the panel must not crash if it does.
    const view = buildResolveView(
      trace({
        candidates: [cand("ghost", 0.9)],
        base_candidates: [cand("room_a", 0.6)],
      }),
    );
    expect(view.rows[0]!.base_rank).toBeNull();
  });
});

describe("normalizeResolveTrace", () => {
  it("accepts a fully-populated v1 trace", () => {
    const t = trace({
      candidates: [cand("room_a", 0.6)],
      base_candidates: [cand("room_a", 0.6)],
    });
    expect(normalizeResolveTrace(t)).toEqual(t);
  });

  it("rejects null / strings / arrays", () => {
    expect(() => normalizeResolveTrace(null)).toThrow();
    expect(() => normalizeResolveTrace("not a trace")).toThrow();
    expect(() => normalizeResolveTrace([])).toThrow();
  });

  it("rejects payloads missing required v1 fields", () => {
    const partial = { query: "x", candidates: [], base_candidates: [] };
    expect(() => normalizeResolveTrace(partial)).toThrow(/missing required/);
  });

  it("rejects payloads where candidates is not an array", () => {
    const broken = {
      ...trace(),
      candidates: "not an array",
    } as unknown;
    expect(() => normalizeResolveTrace(broken)).toThrow();
  });
});

describe("clarificationRows", () => {
  it("renders one row per clarification candidate with sequential ranks", () => {
    const rows = clarificationRows({
      question: "which room?",
      candidates: [cand("room_a", 0.5), cand("room_b", 0.5)],
    });
    expect(rows.map((r) => `${r.rank}:${r.node_id}`)).toEqual([
      "1:room_a",
      "2:room_b",
    ]);
    expect(rows.every((r) => r.base_rank === null)).toBe(true);
    expect(rows.every((r) => !r.is_llm_pick)).toBe(true);
  });
});
