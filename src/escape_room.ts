import type { EscapeRoomStatus } from "./types";

export type EventKind = "system" | "item" | "riddle" | "twist" | "escape" | "other";

export interface EscapeRoomEventRow {
  text: string;
  kind: EventKind;
}

export interface EscapeRoomQuest {
  roomId: string;
  title: string;
  detail: string;
  mechanic: string;
  complete: boolean;
}

export interface EscapeRoomView {
  turn: number;
  caption: string;
  detail: string;
  events: EscapeRoomEventRow[];
  isEscaped: boolean;
  quest: EscapeRoomQuest | null;
}

export function classifyEvent(text: string): EventKind {
  if (text === "ESCAPED") {
    return "escape";
  }
  if (text.startsWith("item:")) {
    return "item";
  }
  if (text.startsWith("riddle:")) {
    return "riddle";
  }
  if (text.startsWith("twist:")) {
    return "twist";
  }
  if (text.startsWith("T-0")) {
    return "system";
  }
  return "other";
}

function buildQuest(status: EscapeRoomStatus): EscapeRoomQuest | null {
  if (!status.quest_title) {
    return null;
  }
  return {
    roomId: status.room_id ?? "",
    title: status.quest_title,
    detail: status.quest_detail ?? "",
    mechanic: status.quest_mechanic ?? "",
    complete: status.quest_complete === true,
  };
}

export function buildEscapeRoomView(status: EscapeRoomStatus): EscapeRoomView {
  const events = status.events.map((text) => ({
    text,
    kind: classifyEvent(text),
  }));
  return {
    turn: status.turn,
    caption: status.caption,
    detail: status.detail,
    events,
    isEscaped: status.events.includes("ESCAPED"),
    quest: buildQuest(status),
  };
}

const REQUIRED_FIELDS: (keyof EscapeRoomStatus)[] = [
  "turn",
  "caption",
  "detail",
  "events",
];

export function normalizeEscapeRoomStatus(raw: unknown): EscapeRoomStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("payload is not an EscapeRoomStatus object");
  }
  const obj = raw as Record<string, unknown>;
  const missing = REQUIRED_FIELDS.filter((k) => !(k in obj));
  if (missing.length > 0) {
    throw new Error(
      `payload is missing required EscapeRoomStatus fields: ${missing.join(", ")}`,
    );
  }
  if (typeof obj.turn !== "number" || !Number.isFinite(obj.turn)) {
    throw new Error("EscapeRoomStatus.turn must be a finite number");
  }
  if (typeof obj.caption !== "string" || typeof obj.detail !== "string") {
    throw new Error("EscapeRoomStatus caption / detail must be strings");
  }
  if (!Array.isArray(obj.events) || !obj.events.every((e) => typeof e === "string")) {
    throw new Error("EscapeRoomStatus.events must be a string array");
  }
  const optionalString = (key: keyof EscapeRoomStatus): string | undefined => {
    if (!(key in obj)) {
      return undefined;
    }
    const value = obj[key];
    if (typeof value !== "string") {
      throw new Error(`EscapeRoomStatus.${key} must be a string when present`);
    }
    return value;
  };
  if ("quest_complete" in obj && typeof obj.quest_complete !== "boolean") {
    throw new Error("EscapeRoomStatus.quest_complete must be a boolean when present");
  }
  return {
    turn: obj.turn,
    caption: obj.caption,
    detail: obj.detail,
    events: obj.events as string[],
    room_id: optionalString("room_id"),
    quest_title: optionalString("quest_title"),
    quest_detail: optionalString("quest_detail"),
    quest_mechanic: optionalString("quest_mechanic"),
    quest_complete:
      "quest_complete" in obj ? (obj.quest_complete as boolean) : undefined,
  };
}
