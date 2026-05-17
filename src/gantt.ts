import type { FleetPlanResult, PlanWithSchedulerResult, ReasonCode, Reservation } from "./types";

// Row in the per-agent Gantt rendering. Pure data transform — kept
// separate from the React panel so it can be unit-tested without
// pulling in the Foxglove extension API.
export interface GanttBar {
  resource_id: string;
  // Seconds from midnight. end_s may be < start_s when the original
  // reservation wraps past midnight; renderers should treat that as
  // (start_s..end_of_day) ∪ (start_of_day..end_s).
  start_s: number;
  end_s: number;
  wraps_midnight: boolean;
}

export interface GanttRow {
  agent_id: string;
  granted: boolean;
  reason_code: ReasonCode;
  failure_reason: string | null;
  bars: GanttBar[];
}

export interface GanttView {
  rows: GanttRow[];
  // Time-axis window the renderer should default to. Both numbers are
  // seconds from midnight, clipped to [0, 86400). When the fleet plan
  // is empty the window degenerates to [0, 0].
  axis_start_s: number;
  axis_end_s: number;
}

const SECONDS_PER_DAY = 24 * 60 * 60;

export function parseHmsToSeconds(hms: string): number {
  // HH:MM:SS pattern is locked by the v1 JSON Schema (^[0-9]{2}:[0-9]{2}:[0-9]{2}$).
  // We re-validate so a malformed payload from a non-conformant publisher
  // surfaces as a clear error rather than silently producing NaN bars.
  const m = /^([0-9]{2}):([0-9]{2}):([0-9]{2})$/.exec(hms);
  if (!m) {
    throw new Error(`reservation time not in HH:MM:SS form: ${hms}`);
  }
  const h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  if (h > 23 || mm > 59 || ss > 59) {
    throw new Error(`reservation time out of range: ${hms}`);
  }
  return h * 3600 + mm * 60 + ss;
}

function barFromReservation(r: Reservation): GanttBar {
  const start_s = parseHmsToSeconds(r.start);
  const end_s = parseHmsToSeconds(r.end);
  return {
    resource_id: r.resource_id,
    start_s,
    end_s,
    wraps_midnight: end_s <= start_s,
  };
}

function rowFromResult(result: PlanWithSchedulerResult): GanttRow {
  return {
    agent_id: result.agent_id,
    granted: result.granted,
    reason_code: result.reason_code,
    failure_reason: result.failure_reason,
    bars: result.claims.map(barFromReservation),
  };
}

export function buildGanttView(fleet: FleetPlanResult): GanttView {
  const rows = fleet.results.map(rowFromResult);

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    for (const bar of row.bars) {
      minStart = Math.min(minStart, bar.start_s);
      // For wrapping bars, treat them as ending at end_of_day for axis
      // sizing — the renderer is responsible for splitting the bar.
      const effective_end = bar.wraps_midnight ? SECONDS_PER_DAY : bar.end_s;
      maxEnd = Math.max(maxEnd, effective_end);
    }
  }

  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return { rows, axis_start_s: 0, axis_end_s: 0 };
  }
  return { rows, axis_start_s: minStart, axis_end_s: maxEnd };
}
