import { Immutable, MessageEvent, PanelExtensionContext, RenderState } from "@foxglove/extension";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { buildGanttView, GanttBar, GanttRow, GanttView } from "./gantt";
import type { FleetPlanResult, ReasonCode } from "./types";

const FLEET_TOPIC = "/fleet_plan_result";

const REASON_COLOR: Record<ReasonCode, string> = {
  ok: "#3aa757",
  no_path: "#c9a227",
  deadline_miss: "#d8742c",
  reservation_conflict: "#cf3a3a",
  policy_rejected: "#7a3acf",
};

function formatHms(seconds: number): string {
  const clamped = Math.max(0, Math.min(86400, Math.round(seconds)));
  const h = Math.floor(clamped / 3600).toString().padStart(2, "0");
  const m = Math.floor((clamped % 3600) / 60).toString().padStart(2, "0");
  const s = (clamped % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function BarRect({
  bar,
  rowIndex,
  view,
  rowHeight,
  labelWidth,
  width,
  axisHeight,
  color,
}: {
  bar: GanttBar;
  rowIndex: number;
  view: GanttView;
  rowHeight: number;
  labelWidth: number;
  width: number;
  axisHeight: number;
  color: string;
}): JSX.Element {
  const span = Math.max(1, view.axis_end_s - view.axis_start_s);
  const plotWidth = width - labelWidth;
  const y = axisHeight + rowIndex * rowHeight + 4;
  const h = rowHeight - 8;

  const xFor = (s: number) =>
    labelWidth + ((s - view.axis_start_s) / span) * plotWidth;

  // Wrapping bars get rendered as two segments. Renderers below the axis
  // are responsible for clipping to the visible window.
  if (bar.wraps_midnight) {
    const x1 = xFor(bar.start_s);
    const x2 = labelWidth + plotWidth;
    const x3 = labelWidth;
    const x4 = xFor(bar.end_s);
    return (
      <g>
        <rect x={x1} y={y} width={Math.max(2, x2 - x1)} height={h} fill={color} opacity={0.8} />
        <rect x={x3} y={y} width={Math.max(2, x4 - x3)} height={h} fill={color} opacity={0.8} />
      </g>
    );
  }
  const x = xFor(bar.start_s);
  const w = Math.max(2, xFor(bar.end_s) - x);
  return <rect x={x} y={y} width={w} height={h} fill={color} opacity={0.85}><title>{`${bar.resource_id}  ${formatHms(bar.start_s)} → ${formatHms(bar.end_s)}`}</title></rect>;
}

function GanttSvg({ view }: { view: GanttView }): JSX.Element {
  const width = 800;
  const rowHeight = 32;
  const labelWidth = 140;
  const axisHeight = 24;
  const height = Math.max(rowHeight + axisHeight, view.rows.length * rowHeight + axisHeight);

  return (
    <svg width={width} height={height} role="img" aria-label="fleet plan gantt">
      <line x1={labelWidth} y1={axisHeight} x2={width} y2={axisHeight} stroke="#888" />
      <text x={labelWidth} y={axisHeight - 6} fontSize={11} fill="#888">
        {formatHms(view.axis_start_s)}
      </text>
      <text x={width - 4} y={axisHeight - 6} fontSize={11} fill="#888" textAnchor="end">
        {formatHms(view.axis_end_s)}
      </text>
      {view.rows.map((row, i) => (
        <g key={row.agent_id}>
          <text
            x={labelWidth - 8}
            y={axisHeight + i * rowHeight + rowHeight / 2 + 4}
            fontSize={12}
            fill={row.granted ? "#ddd" : REASON_COLOR[row.reason_code]}
            textAnchor="end"
          >
            {row.agent_id} {row.granted ? "" : `· ${row.reason_code}`}
          </text>
          {row.bars.map((bar, j) => (
            <BarRect
              key={`${row.agent_id}-${j}`}
              bar={bar}
              rowIndex={i}
              view={view}
              rowHeight={rowHeight}
              labelWidth={labelWidth}
              width={width}
              axisHeight={axisHeight}
              color={REASON_COLOR[row.reason_code]}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function rowSummary(row: GanttRow): string {
  if (row.granted) {
    return `${row.bars.length} claim${row.bars.length === 1 ? "" : "s"}`;
  }
  return row.failure_reason ?? row.reason_code;
}

function SemanticTopoNavPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly { name: string; schemaName?: string }[]>([]);
  const [fleet, setFleet] = useState<FleetPlanResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  useLayoutEffect(() => {
    context.onRender = (renderState: Immutable<RenderState>, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics ?? []);

      const last = renderState.currentFrame?.find((m) => m.topic === FLEET_TOPIC);
      if (last) {
        try {
          const parsed = decodeFleetMessage(last);
          setFleet(parsed);
          setParseError(null);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    context.watch("topics");
    context.watch("currentFrame");
    context.subscribe([{ topic: FLEET_TOPIC }]);
  }, [context]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  const view = useMemo<GanttView>(() => {
    if (!fleet) {
      return { rows: [], axis_start_s: 0, axis_end_s: 0 };
    }
    return buildGanttView(fleet);
  }, [fleet]);

  const hasTopic = useMemo(
    () => topics.some((t) => t.name === FLEET_TOPIC),
    [topics],
  );

  return (
    <div style={{ padding: 12, fontFamily: "ui-sans-serif, system-ui", color: "#ddd" }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Semantic TopoNav · Fleet plan</strong>
        <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>topic: {FLEET_TOPIC}</span>
      </div>
      {!hasTopic && (
        <div style={{ color: "#c9a227", fontSize: 12, marginBottom: 8 }}>
          waiting for a publisher on <code>{FLEET_TOPIC}</code> (expects a
          FleetPlanResult JSON payload — see README for the wire format).
        </div>
      )}
      {parseError && (
        <div style={{ color: "#cf3a3a", fontSize: 12, marginBottom: 8 }}>
          parse error: {parseError}
        </div>
      )}
      {fleet && <GanttSvg view={view} />}
      {fleet && (
        <table style={{ marginTop: 12, width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ padding: "4px 8px" }}>agent</th>
              <th style={{ padding: "4px 8px" }}>granted</th>
              <th style={{ padding: "4px 8px" }}>reason</th>
              <th style={{ padding: "4px 8px" }}>detail</th>
            </tr>
          </thead>
          <tbody>
            {view.rows.map((row) => (
              <tr key={row.agent_id} style={{ borderTop: "1px solid #333" }}>
                <td style={{ padding: "4px 8px" }}>{row.agent_id}</td>
                <td style={{ padding: "4px 8px" }}>{row.granted ? "✓" : "✗"}</td>
                <td style={{ padding: "4px 8px", color: REASON_COLOR[row.reason_code] }}>
                  {row.reason_code}
                </td>
                <td style={{ padding: "4px 8px" }}>{rowSummary(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function decodeFleetMessage(event: Immutable<MessageEvent>): FleetPlanResult {
  const raw = event.message as unknown;
  if (typeof raw === "string") {
    return JSON.parse(raw) as FleetPlanResult;
  }
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (typeof data === "string") {
      return JSON.parse(data) as FleetPlanResult;
    }
  }
  if (raw && typeof raw === "object" && "results" in raw) {
    return raw as FleetPlanResult;
  }
  throw new Error("unable to decode message payload as FleetPlanResult");
}

export function initSemanticTopoNavPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<SemanticTopoNavPanel context={context} />);
  return () => {
    root.unmount();
  };
}
