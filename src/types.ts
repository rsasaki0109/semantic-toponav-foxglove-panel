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
