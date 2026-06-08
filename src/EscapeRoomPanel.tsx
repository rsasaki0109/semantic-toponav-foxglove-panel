import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@foxglove/extension";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  buildEscapeRoomView,
  EscapeRoomView,
  EventKind,
  normalizeEscapeRoomStatus,
} from "./escape_room";
import type { EscapeRoomStatus } from "./types";

const STATUS_TOPIC = "/semantic_toponav/escape_room/status";

const EVENT_COLOR: Record<EventKind, string> = {
  system: "#58a6ff",
  item: "#3aa757",
  riddle: "#c9a227",
  twist: "#d8742c",
  escape: "#22d3ee",
  other: "#888",
};

function decodeStatusMessage(event: Immutable<MessageEvent>): EscapeRoomStatus {
  const raw = event.message as unknown;
  if (typeof raw === "string") {
    return normalizeEscapeRoomStatus(JSON.parse(raw));
  }
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (typeof data === "string") {
      return normalizeEscapeRoomStatus(JSON.parse(data));
    }
  }
  return normalizeEscapeRoomStatus(raw);
}

function EscapeRoomPanelView({ view }: { view: EscapeRoomView }): JSX.Element {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            backgroundColor: "#1f1f1f",
            color: view.isEscaped ? "#22d3ee" : "#58a6ff",
            fontSize: 11,
            marginRight: 8,
          }}
        >
          turn {view.turn}
        </span>
        {view.isEscaped && (
          <span style={{ color: "#22d3ee", fontSize: 12, fontWeight: 600 }}>ESCAPED</span>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: "#f5f5f5" }}>
        {view.caption || "(no caption)"}
      </div>
      {view.detail !== "" && view.detail !== view.caption && (
        <div style={{ marginBottom: 12, color: "#bbb", fontSize: 13 }}>{view.detail}</div>
      )}
      {view.events.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
          {view.events.map((event) => (
            <li key={event.text} style={{ marginBottom: 6, color: EVENT_COLOR[event.kind] }}>
              {event.text}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ color: "#888", fontSize: 12 }}>no puzzle events on this frame</div>
      )}
    </>
  );
}

function EscapeRoomPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly { name: string }[]>([]);
  const [status, setStatus] = useState<EscapeRoomStatus | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  useLayoutEffect(() => {
    context.onRender = (renderState: Immutable<RenderState>, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics ?? []);

      const last = renderState.currentFrame?.find((m) => m.topic === STATUS_TOPIC);
      if (last) {
        try {
          setStatus(decodeStatusMessage(last));
          setParseError(null);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    context.watch("topics");
    context.watch("currentFrame");
    context.subscribe([{ topic: STATUS_TOPIC }]);
  }, [context]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  const view = useMemo<EscapeRoomView | null>(
    () => (status !== null ? buildEscapeRoomView(status) : null),
    [status],
  );

  const hasTopic = useMemo(
    () => topics.some((t) => t.name === STATUS_TOPIC),
    [topics],
  );

  return (
    <div style={{ padding: 12, fontFamily: "ui-sans-serif, system-ui", color: "#ddd" }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Semantic TopoNav · Escape Room</strong>
        <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>topic: {STATUS_TOPIC}</span>
      </div>
      {!hasTopic && (
        <div style={{ color: "#c9a227", fontSize: 12, marginBottom: 8 }}>
          waiting for a publisher on <code>{STATUS_TOPIC}</code> (expects an
          EscapeRoomStatus JSON payload — open
          <code> docs/foxglove/robot_escape_room_demo.mcap</code> from the upstream repo).
        </div>
      )}
      {parseError && (
        <div style={{ color: "#cf3a3a", fontSize: 12, marginBottom: 8 }}>
          parse error: {parseError}
        </div>
      )}
      {view !== null && <EscapeRoomPanelView view={view} />}
    </div>
  );
}

export function initEscapeRoomPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<EscapeRoomPanel context={context} />);
  return () => {
    root.unmount();
  };
}
