import { buildGanttView, parseHmsToSeconds } from "../gantt";
import type { FleetPlanResult } from "../types";

describe("parseHmsToSeconds", () => {
  it("parses HH:MM:SS form", () => {
    expect(parseHmsToSeconds("00:00:00")).toBe(0);
    expect(parseHmsToSeconds("01:02:03")).toBe(3723);
    expect(parseHmsToSeconds("23:59:59")).toBe(86399);
  });

  it("rejects malformed strings", () => {
    expect(() => parseHmsToSeconds("1:02:03")).toThrow();
    expect(() => parseHmsToSeconds("01:02")).toThrow();
    expect(() => parseHmsToSeconds("aa:bb:cc")).toThrow();
  });

  it("rejects out-of-range components", () => {
    expect(() => parseHmsToSeconds("24:00:00")).toThrow();
    expect(() => parseHmsToSeconds("00:60:00")).toThrow();
    expect(() => parseHmsToSeconds("00:00:60")).toThrow();
  });
});

describe("buildGanttView", () => {
  it("returns an empty axis when there are no results", () => {
    const empty: FleetPlanResult = { results: [], all_granted: true };
    const view = buildGanttView(empty);
    expect(view.rows).toEqual([]);
    expect(view.axis_start_s).toBe(0);
    expect(view.axis_end_s).toBe(0);
  });

  it("emits one row per agent and propagates reason_code / granted", () => {
    const fleet: FleetPlanResult = {
      all_granted: false,
      results: [
        {
          agent_id: "alpha",
          path: ["a", "b"],
          granted: true,
          failure_reason: null,
          reason_code: "ok",
          claims: [
            { resource_id: "edge:a-b", start: "09:00:00", end: "09:00:30", agent_id: "alpha" },
          ],
          conflicts: [],
        },
        {
          agent_id: "beta",
          path: [],
          granted: false,
          failure_reason: "blocked by alpha",
          reason_code: "reservation_conflict",
          claims: [],
          conflicts: [
            { resource_id: "edge:a-b", start: "09:00:00", end: "09:00:30", agent_id: "alpha" },
          ],
        },
      ],
    };

    const view = buildGanttView(fleet);
    expect(view.rows.map((r) => r.agent_id)).toEqual(["alpha", "beta"]);

    const [alpha, beta] = view.rows;
    expect(alpha.granted).toBe(true);
    expect(alpha.reason_code).toBe("ok");
    expect(alpha.bars).toHaveLength(1);
    expect(alpha.bars[0]).toMatchObject({
      resource_id: "edge:a-b",
      start_s: 9 * 3600,
      end_s: 9 * 3600 + 30,
      wraps_midnight: false,
    });

    expect(beta.granted).toBe(false);
    expect(beta.reason_code).toBe("reservation_conflict");
    expect(beta.failure_reason).toBe("blocked by alpha");
    expect(beta.bars).toEqual([]);

    expect(view.axis_start_s).toBe(9 * 3600);
    expect(view.axis_end_s).toBe(9 * 3600 + 30);
  });

  it("flags midnight-wrapping bars and treats them as end_of_day for axis sizing", () => {
    const fleet: FleetPlanResult = {
      all_granted: true,
      results: [
        {
          agent_id: "nightshift",
          path: ["a"],
          granted: true,
          failure_reason: null,
          reason_code: "ok",
          claims: [
            { resource_id: "node:a", start: "23:30:00", end: "00:30:00", agent_id: "nightshift" },
          ],
          conflicts: [],
        },
      ],
    };

    const view = buildGanttView(fleet);
    const bar = view.rows[0]!.bars[0]!;
    expect(bar.wraps_midnight).toBe(true);
    expect(bar.start_s).toBe(23 * 3600 + 30 * 60);
    expect(bar.end_s).toBe(30 * 60);
    expect(view.axis_end_s).toBe(86400);
  });
});
