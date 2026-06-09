// TypeScript mirror of the v1-locked wire formats published by
// rsasaki0109/semantic-toponav under `schemas/`. Names and field
// shapes follow the JSON Schema files verbatim. Adding / renaming
// fields here must be paired with a v2 schema bump upstream.

export type ReasonCode =
  | "ok"
  | "no_path"
  | "deadline_miss"
  | "reservation_conflict"
  | "policy_rejected";

export interface Reservation {
  resource_id: string;
  // HH:MM:SS, end <= start wraps midnight.
  start: string;
  end: string;
  agent_id: string | null;
}

export interface PlanWithSchedulerResult {
  agent_id: string;
  path: string[];
  claims: Reservation[];
  granted: boolean;
  failure_reason: string | null;
  conflicts: Reservation[];
  reason_code: ReasonCode;
}

export interface FleetPlanResult {
  results: PlanWithSchedulerResult[];
  all_granted: boolean;
}

export interface ConflictExplanation {
  blocked_agent_id: string;
  reason_code: ReasonCode;
  blocking_agents: string[];
  blocking_resources: string[];
  detail: string;
}

// ResolveTrace v1 (`schemas/resolve_trace_v1.schema.json`) — emitted by
// `LLMResolveResult.to_dict` in the upstream Python resolver. The panel
// renders the final ranking joined against the deterministic baseline
// and surfaces the LLM pick / used_fallback / clarification path.

export interface GoalCandidate {
  node_id: string;
  score: number;
  reasons: string[];
}

export interface ClarificationQuestion {
  question: string;
  candidates: GoalCandidate[];
}

export interface ResolveTrace {
  query: string;
  candidates: GoalCandidate[];
  base_candidates: GoalCandidate[];
  llm_pick: string | null;
  llm_reason: string | null;
  raw_response: string;
  used_fallback: boolean;
  embedding_scores: Record<string, number>;
  clarification: ClarificationQuestion | null;
}

// EscapeRoomStatus — emitted by the robot-escape-room demo MCAP exporter
// and the escape_room_runner ROS node on
// `/semantic_toponav/escape_room/status`. Not one of the six v1-locked
// product schemas, but stable demo/replay support.

export interface EscapeRoomStatus {
  turn: number;
  caption: string;
  detail: string;
  events: string[];
}
