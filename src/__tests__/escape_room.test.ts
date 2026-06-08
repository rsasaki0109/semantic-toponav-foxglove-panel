import {
  buildEscapeRoomView,
  classifyEvent,
  normalizeEscapeRoomStatus,
} from "../escape_room";
import type { EscapeRoomStatus } from "../types";

function status(extra: Partial<EscapeRoomStatus> = {}): EscapeRoomStatus {
  return {
    turn: 1,
    caption: "Investigate Server Room",
    detail: "investigate Server Room",
    events: ["T-0 online — Holding Cell"],
    ...extra,
  };
}

describe("classifyEvent", () => {
  it("maps the shipped escape-room event vocabulary", () => {
    expect(classifyEvent("T-0 online — Holding Cell")).toBe("system");
    expect(classifyEvent("item: keycard_blue")).toBe("item");
    expect(classifyEvent("riddle: riddle_1")).toBe("riddle");
    expect(classifyEvent("twist: Floor-3 exit sealed")).toBe("twist");
    expect(classifyEvent("ESCAPED")).toBe("escape");
    expect(classifyEvent("something else")).toBe("other");
  });
});

describe("buildEscapeRoomView", () => {
  it("builds colored event rows and flags escape", () => {
    const view = buildEscapeRoomView(
      status({
        turn: 6,
        caption: "Escape via Maintenance Exit",
        events: [
          "T-0 online — Holding Cell",
          "item: hatch_code",
          "twist: Floor-3 exit sealed",
          "ESCAPED",
        ],
      }),
    );
    expect(view.turn).toBe(6);
    expect(view.isEscaped).toBe(true);
    expect(view.events.map((e) => `${e.kind}:${e.text}`)).toEqual([
      "system:T-0 online — Holding Cell",
      "item:item: hatch_code",
      "twist:twist: Floor-3 exit sealed",
      "escape:ESCAPED",
    ]);
  });
});

describe("normalizeEscapeRoomStatus", () => {
  it("accepts a fully-populated status", () => {
    const s = status({ events: ["riddle: riddle_1"] });
    expect(normalizeEscapeRoomStatus(s)).toEqual(s);
  });

  it("rejects null / strings / arrays", () => {
    expect(() => normalizeEscapeRoomStatus(null)).toThrow();
    expect(() => normalizeEscapeRoomStatus("not status")).toThrow();
    expect(() => normalizeEscapeRoomStatus([])).toThrow();
  });

  it("rejects payloads missing required fields", () => {
    expect(() => normalizeEscapeRoomStatus({ turn: 1, caption: "x" })).toThrow(
      /missing required/,
    );
  });

  it("rejects non-string events", () => {
    expect(() =>
      normalizeEscapeRoomStatus({
        turn: 1,
        caption: "x",
        detail: "x",
        events: [1],
      }),
    ).toThrow(/string array/);
  });
});
