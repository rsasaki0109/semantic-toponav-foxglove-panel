import type {
  ClarificationQuestion,
  GoalCandidate,
  ResolveTrace,
} from "./types";

// One row per candidate in the final ranking. `base_rank` is the
// position the deterministic resolver placed this node at — diffing
// `rank` against `base_rank` makes the LLM rewrite legible at a
// glance. `embedding_score` is present iff a query_encoder was
// supplied to the upstream resolver.
export interface ResolveRow {
  rank: number;
  node_id: string;
  score: number;
  base_rank: number | null;
  embedding_score: number | null;
  reasons: string[];
  is_llm_pick: boolean;
}

export type PickStatus =
  | "clarification_pending"
  | "llm_pick"
  | "fallback"
  | "no_pick";

export interface ResolveView {
  query: string;
  rows: ResolveRow[];
  pickStatus: PickStatus;
  llm_pick: string | null;
  llm_reason: string | null;
  used_fallback: boolean;
  clarification: ClarificationQuestion | null;
  hasEmbeddingScores: boolean;
}

function pickStatus(trace: ResolveTrace): PickStatus {
  if (trace.clarification !== null) {
    return "clarification_pending";
  }
  if (trace.used_fallback) {
    return "fallback";
  }
  if (trace.llm_pick !== null) {
    return "llm_pick";
  }
  return "no_pick";
}

export function buildResolveView(trace: ResolveTrace): ResolveView {
  const baseRankByNode = new Map<string, number>();
  trace.base_candidates.forEach((c, i) => {
    if (!baseRankByNode.has(c.node_id)) {
      baseRankByNode.set(c.node_id, i + 1);
    }
  });

  const hasEmbeddingScores = Object.keys(trace.embedding_scores).length > 0;

  const rows: ResolveRow[] = trace.candidates.map((c, i) => {
    const base = baseRankByNode.get(c.node_id);
    const emb = trace.embedding_scores[c.node_id];
    return {
      rank: i + 1,
      node_id: c.node_id,
      score: c.score,
      base_rank: base ?? null,
      embedding_score: typeof emb === "number" ? emb : null,
      reasons: c.reasons,
      is_llm_pick: trace.llm_pick === c.node_id,
    };
  });

  return {
    query: trace.query,
    rows,
    pickStatus: pickStatus(trace),
    llm_pick: trace.llm_pick,
    llm_reason: trace.llm_reason,
    used_fallback: trace.used_fallback,
    clarification: trace.clarification,
    hasEmbeddingScores,
  };
}

// The wire shape on /resolve_trace is a single ResolveTrace object
// (one resolve per emit — there is no array form in the upstream
// `LLMResolveResult.to_dict`). Anything missing the required v1
// fields is rejected so the panel surfaces a parse error instead of
// rendering garbage.
const REQUIRED_FIELDS: (keyof ResolveTrace)[] = [
  "query",
  "candidates",
  "base_candidates",
  "llm_pick",
  "llm_reason",
  "raw_response",
  "used_fallback",
  "embedding_scores",
  "clarification",
];

export function normalizeResolveTrace(raw: unknown): ResolveTrace {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("payload is not a ResolveTrace object");
  }
  const obj = raw as Record<string, unknown>;
  const missing = REQUIRED_FIELDS.filter((k) => !(k in obj));
  if (missing.length > 0) {
    throw new Error(
      `payload is missing required ResolveTrace fields: ${missing.join(", ")}`,
    );
  }
  if (!Array.isArray(obj.candidates) || !Array.isArray(obj.base_candidates)) {
    throw new Error("ResolveTrace candidates / base_candidates must be arrays");
  }
  return obj as unknown as ResolveTrace;
}

// Exported so the panel can render the candidates inside a
// ClarificationQuestion using the same row layout as the main table.
export function clarificationRows(q: ClarificationQuestion): ResolveRow[] {
  return q.candidates.map(
    (c: GoalCandidate, i: number): ResolveRow => ({
      rank: i + 1,
      node_id: c.node_id,
      score: c.score,
      base_rank: null,
      embedding_score: null,
      reasons: c.reasons,
      is_llm_pick: false,
    }),
  );
}
