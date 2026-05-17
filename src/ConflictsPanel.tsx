import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@foxglove/extension";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { buildConflictsView, ConflictsView, normalizeConflicts } from "./conflicts";
import type { ConflictExplanation, ReasonCode } from "./types";

const CONFLICTS_TOPIC = "/conflict_explanations";

const REASON_COLOR: Record<ReasonCode, string> = {
  ok: "#3aa757",
  no_path: "#c9a227",
  deadline_miss: "#d8742c",
  reservation_conflict: "#cf3a3a",
  policy_rejected: "#7a3acf",
};

function decodeConflictsMessage(event: Immutable<MessageEvent>): ConflictExplanation[] {
  const raw = event.message as unknown;
  if (typeof raw === "string") {
    return normalizeConflicts(JSON.parse(raw));
  }
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (typeof data === "string") {
      return normalizeConflicts(JSON.parse(data));
    }
  }
  return normalizeConflicts(raw);
}

function ReasonBadge({ reason_code, count }: { reason_code: ReasonCode; count: number }): JSX.Element {
  return (
    <span
      style={{
        marginRight: 8,
        padding: "2px 6px",
        borderRadius: 4,
        backgroundColor: "#1f1f1f",
        color: count > 0 ? REASON_COLOR[reason_code] : "#666",
        fontSize: 11,
      }}
    >
      {reason_code}: {count}
    </span>
  );
}

function ConflictsPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly { name: string }[]>([]);
  const [conflicts, setConflicts] = useState<ConflictExplanation[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  useLayoutEffect(() => {
    context.onRender = (renderState: Immutable<RenderState>, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics ?? []);

      const last = renderState.currentFrame?.find((m) => m.topic === CONFLICTS_TOPIC);
      if (last) {
        try {
          setConflicts(decodeConflictsMessage(last));
          setParseError(null);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    context.watch("topics");
    context.watch("currentFrame");
    context.subscribe([{ topic: CONFLICTS_TOPIC }]);
  }, [context]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  const view = useMemo<ConflictsView>(() => {
    return buildConflictsView(conflicts ?? []);
  }, [conflicts]);

  const hasTopic = useMemo(
    () => topics.some((t) => t.name === CONFLICTS_TOPIC),
    [topics],
  );

  return (
    <div style={{ padding: 12, fontFamily: "ui-sans-serif, system-ui", color: "#ddd" }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Semantic TopoNav · Conflicts</strong>
        <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>topic: {CONFLICTS_TOPIC}</span>
      </div>
      {!hasTopic && (
        <div style={{ color: "#c9a227", fontSize: 12, marginBottom: 8 }}>
          waiting for a publisher on <code>{CONFLICTS_TOPIC}</code> (expects a
          ConflictExplanation v1 JSON payload, either a single record or an
          array — see README for the wire format).
        </div>
      )}
      {parseError && (
        <div style={{ color: "#cf3a3a", fontSize: 12, marginBottom: 8 }}>
          parse error: {parseError}
        </div>
      )}
      {conflicts && (
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          <ReasonBadge reason_code="reservation_conflict" count={view.byReason.reservation_conflict} />
          <ReasonBadge reason_code="deadline_miss" count={view.byReason.deadline_miss} />
          <ReasonBadge reason_code="no_path" count={view.byReason.no_path} />
          <ReasonBadge reason_code="policy_rejected" count={view.byReason.policy_rejected} />
          <span style={{ color: "#888", marginLeft: 8 }}>total: {view.total}</span>
        </div>
      )}
      {conflicts && view.rows.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "4px 8px" }}>blocked agent</th>
              <th style={{ padding: "4px 8px" }}>reason</th>
              <th style={{ padding: "4px 8px" }}>blocking agents</th>
              <th style={{ padding: "4px 8px" }}>blocking resources</th>
              <th style={{ padding: "4px 8px" }}>detail</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row, i) => (
              <tr
                key={`${row.blocked_agent_id}-${i}`}
                style={{ borderTop: "1px solid #333", verticalAlign: "top" }}
              >
                <td style={{ padding: "4px 8px" }}>{row.blocked_agent_id}</td>
                <td style={{ padding: "4px 8px", color: REASON_COLOR[row.reason_code] }}>
                  {row.reason_code}
                </td>
                <td style={{ padding: "4px 8px" }}>
                  {row.blocking_agents.length === 0 ? "—" : row.blocking_agents.join(", ")}
                </td>
                <td style={{ padding: "4px 8px" }}>
                  {row.blocking_resources.length === 0
                    ? "—"
                    : row.blocking_resources.map((r) => (
                        <code key={r} style={{ marginRight: 6 }}>
                          {r}
                        </code>
                      ))}
                </td>
                <td style={{ padding: "4px 8px", color: "#bbb" }}>{row.detail || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {conflicts && view.rows.length === 0 && (
        <div style={{ color: "#3aa757", fontSize: 12 }}>no conflicts in the latest frame</div>
      )}
    </div>
  );
}

export function initConflictsPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<ConflictsPanel context={context} />);
  return () => {
    root.unmount();
  };
}
