import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@foxglove/extension";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  buildResolveView,
  clarificationRows,
  normalizeResolveTrace,
  PickStatus,
  ResolveRow,
  ResolveView,
} from "./resolve";
import type { ResolveTrace } from "./types";

const RESOLVE_TOPIC = "/resolve_trace";

// Reusing the palette from the other panels for visual coherence
// across a 3-panel layout (Fleet / Conflicts / Resolve).
const STATUS_COLOR: Record<PickStatus, string> = {
  clarification_pending: "#c9a227",
  llm_pick: "#3aa757",
  fallback: "#d8742c",
  no_pick: "#888",
};

const STATUS_LABEL: Record<PickStatus, string> = {
  clarification_pending: "clarification pending",
  llm_pick: "llm pick",
  fallback: "fallback (deterministic)",
  no_pick: "no pick",
};

function decodeResolveMessage(event: Immutable<MessageEvent>): ResolveTrace {
  const raw = event.message as unknown;
  if (typeof raw === "string") {
    return normalizeResolveTrace(JSON.parse(raw));
  }
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (typeof data === "string") {
      return normalizeResolveTrace(JSON.parse(data));
    }
  }
  return normalizeResolveTrace(raw);
}

function formatScore(s: number): string {
  return s.toFixed(3);
}

function RankBadge({ row }: { row: ResolveRow }): JSX.Element {
  if (row.base_rank === null) {
    return <span>{row.rank}</span>;
  }
  if (row.base_rank === row.rank) {
    return <span>{row.rank}</span>;
  }
  const arrow = row.base_rank > row.rank ? "↑" : "↓";
  const color = row.base_rank > row.rank ? "#3aa757" : "#d8742c";
  return (
    <span>
      {row.rank}
      <span style={{ marginLeft: 4, color, fontSize: 11 }}>
        {arrow}from {row.base_rank}
      </span>
    </span>
  );
}

function ResolveRowsTable({
  rows,
  showEmbedding,
}: {
  rows: ResolveRow[];
  showEmbedding: boolean;
}): JSX.Element {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr style={{ textAlign: "left", color: "#888" }}>
          <th style={{ padding: "4px 8px" }}>rank</th>
          <th style={{ padding: "4px 8px" }}>node</th>
          <th style={{ padding: "4px 8px" }}>score</th>
          {showEmbedding && <th style={{ padding: "4px 8px" }}>embedding</th>}
          <th style={{ padding: "4px 8px" }}>reasons</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.rank}-${row.node_id}`}
            style={{
              borderTop: "1px solid #333",
              verticalAlign: "top",
              backgroundColor: row.is_llm_pick ? "#162a16" : undefined,
            }}
          >
            <td style={{ padding: "4px 8px" }}>
              <RankBadge row={row} />
            </td>
            <td style={{ padding: "4px 8px" }}>
              <code>{row.node_id}</code>
              {row.is_llm_pick && (
                <span style={{ marginLeft: 6, color: "#3aa757", fontSize: 11 }}>
                  ← llm pick
                </span>
              )}
            </td>
            <td style={{ padding: "4px 8px" }}>{formatScore(row.score)}</td>
            {showEmbedding && (
              <td style={{ padding: "4px 8px" }}>
                {row.embedding_score === null ? "—" : formatScore(row.embedding_score)}
              </td>
            )}
            <td style={{ padding: "4px 8px", color: "#bbb" }}>
              {row.reasons.length === 0 ? "—" : row.reasons.join("; ")}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResolvePanelView({ view }: { view: ResolveView }): JSX.Element {
  return (
    <>
      <div style={{ marginBottom: 8, fontSize: 12 }}>
        <span
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            backgroundColor: "#1f1f1f",
            color: STATUS_COLOR[view.pickStatus],
            marginRight: 8,
          }}
        >
          {STATUS_LABEL[view.pickStatus]}
        </span>
        {view.llm_pick !== null && (
          <span style={{ color: "#bbb" }}>
            llm_pick: <code>{view.llm_pick}</code>
          </span>
        )}
      </div>
      {view.llm_reason !== null && view.llm_reason !== "" && (
        <div style={{ marginBottom: 8, color: "#bbb", fontSize: 12 }}>
          <span style={{ color: "#888" }}>llm_reason:</span> {view.llm_reason}
        </div>
      )}
      {view.clarification !== null && (
        <div
          style={{
            marginBottom: 8,
            padding: 8,
            border: "1px solid #c9a227",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          <div style={{ marginBottom: 4, color: "#c9a227" }}>
            clarification: {view.clarification.question}
          </div>
          <ResolveRowsTable
            rows={clarificationRows(view.clarification)}
            showEmbedding={false}
          />
        </div>
      )}
      {view.rows.length > 0 && (
        <ResolveRowsTable rows={view.rows} showEmbedding={view.hasEmbeddingScores} />
      )}
      {view.rows.length === 0 && view.clarification === null && (
        <div style={{ color: "#888", fontSize: 12 }}>no candidates in this trace</div>
      )}
    </>
  );
}

function ResolvePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly { name: string }[]>([]);
  const [trace, setTrace] = useState<ResolveTrace | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  useLayoutEffect(() => {
    context.onRender = (renderState: Immutable<RenderState>, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics ?? []);

      const last = renderState.currentFrame?.find((m) => m.topic === RESOLVE_TOPIC);
      if (last) {
        try {
          setTrace(decodeResolveMessage(last));
          setParseError(null);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    context.watch("topics");
    context.watch("currentFrame");
    context.subscribe([{ topic: RESOLVE_TOPIC }]);
  }, [context]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  const view = useMemo<ResolveView | null>(
    () => (trace !== null ? buildResolveView(trace) : null),
    [trace],
  );

  const hasTopic = useMemo(
    () => topics.some((t) => t.name === RESOLVE_TOPIC),
    [topics],
  );

  return (
    <div style={{ padding: 12, fontFamily: "ui-sans-serif, system-ui", color: "#ddd" }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Semantic TopoNav · Resolve</strong>
        <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>topic: {RESOLVE_TOPIC}</span>
      </div>
      {trace !== null && (
        <div style={{ marginBottom: 8, fontSize: 12, color: "#bbb" }}>
          <span style={{ color: "#888" }}>query:</span>{" "}
          <span style={{ color: "#ddd" }}>{trace.query || "(empty)"}</span>
        </div>
      )}
      {!hasTopic && (
        <div style={{ color: "#c9a227", fontSize: 12, marginBottom: 8 }}>
          waiting for a publisher on <code>{RESOLVE_TOPIC}</code> (expects a
          ResolveTrace v1 JSON payload — see README for the wire format).
        </div>
      )}
      {parseError && (
        <div style={{ color: "#cf3a3a", fontSize: 12, marginBottom: 8 }}>
          parse error: {parseError}
        </div>
      )}
      {view !== null && <ResolvePanelView view={view} />}
    </div>
  );
}

export function initResolvePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<ResolvePanel context={context} />);
  return () => {
    root.unmount();
  };
}
