# semantic-toponav-foxglove-panel

[Foxglove](https://foxglove.dev/) extension panel that visualizes the
v1-locked wire formats produced by
[`semantic-toponav`](https://github.com/rsasaki0109/semantic-toponav)
— a multi-agent semantic-topological planning layer.

As of v0.4.0 the extension ships **four** panels — three for the v1 wire
formats plus the escape-room replay status panel:

- **Semantic TopoNav Panel** — subscribes to `/fleet_plan_result`,
  decodes the `FleetPlanResult` v1 payload, and draws a per-agent
  reservation Gantt plus a `reason_code`-colored status table. Granted
  agents and denied agents are visually separated; midnight-wrapping
  reservations (`end <= start`) are detected and rendered as two
  segments.
- **Semantic TopoNav Conflicts** — subscribes to
  `/conflict_explanations`, decodes the `ConflictExplanation` v1
  payload (either a single record or an array of them, both shapes
  are accepted), and renders a count-by-`reason_code` summary band
  plus a row-per-conflict table with `blocked_agent_id`,
  `blocking_agents`, `blocking_resources`, and `detail`. Sits beside
  the Fleet panel for diagnosing `reservation_conflict` denials.
- **Semantic TopoNav Resolve** — subscribes to `/resolve_trace`,
  decodes the `ResolveTrace` v1 payload (`LLMResolveResult.to_dict`
  from the upstream resolver), and renders the final candidate
  ranking joined against the deterministic baseline so the LLM
  rewrite is legible at a glance. Surfaces `pick_status` (`llm_pick`
  / `fallback` / `clarification_pending` / `no_pick`), the LLM's
  picked node + one-line reason, and `embedding_score` per candidate
  when a `query_encoder` was supplied upstream. When the resolver
  emits a `clarification`, the question + its candidate set are
  rendered in a separate band above the main table.
- **Semantic TopoNav Escape Room** — subscribes to
  `/semantic_toponav/escape_room/status`, decodes the
  `EscapeRoomStatus` demo/replay payload from the
  [`RobotEscapeRoom`](https://github.com/rsasaki0109/RobotEscapeRoom)
  MCAP exporter, and renders the turn caption + color-coded puzzle
  events (items, riddles, the Floor-3 twist, escape). Drop it beside
  the 3D scene when replaying `robot_escape_room_demo.mcap`.

## Wire format

The panel decodes the JSON Schemas locked in `semantic-toponav` at
`v1.0.0`:

- [`FleetPlanResult`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/fleet_plan_result_v1.schema.json)
- [`PlanWithSchedulerResult`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/plan_with_scheduler_result_v1.schema.json)
- [`ConflictExplanation`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/conflict_explanation_v1.schema.json)
- [`ResolveTrace`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/resolve_trace_v1.schema.json)
- `EscapeRoomStatus` — demo/replay JSON on
  `/semantic_toponav/escape_room/status` (not one of the six v1 product
  schemas; defined in the upstream
  [`export_escape_room_foxglove_mcap.py`](https://github.com/rsasaki0109/RobotEscapeRoom/blob/main/examples/export_escape_room_foxglove_mcap.py))

The TypeScript mirror lives in `src/types.ts`. Pure data transforms —
`src/gantt.ts` for `FleetPlanResult → GanttView`, `src/conflicts.ts`
for `ConflictExplanation[] → ConflictsView`, `src/resolve.ts` for
`ResolveTrace → ResolveView`, and `src/escape_room.ts` for
`EscapeRoomStatus → EscapeRoomView` — sit separately from the panel files
and are unit-tested under `src/__tests__/`.

Compatible with upstream `>= v1.0.0`. A v2 schema bump upstream would
require a matching major bump here.

## Topic conventions

| Topic                      | Payload                                                                                                    |
|----------------------------|------------------------------------------------------------------------------------------------------------|
| `/fleet_plan_result`       | JSON-serialized `FleetPlanResult` (either as a string or as a `data` field on a schemaless message).       |
| `/conflict_explanations`   | JSON-serialized `ConflictExplanation[]` or a single `ConflictExplanation`. Inline string or `data` field.  |
| `/resolve_trace`           | JSON-serialized `ResolveTrace` (single record per emit). Inline string or `data` field.                    |
| `/semantic_toponav/escape_room/status` | JSON-serialized `EscapeRoomStatus` (turn caption + puzzle events). Inline string or `data` field. |

You can publish such a topic from any bridge — the simplest path is to
serialize the dataclass via `dataclasses.asdict` in the upstream
Python and forward over rosbridge / a websocket layer / a foxglove
WebSocket connection.

## Development

Prereqs: Node 20+.

```bash
npm install
npm run typecheck
npm test
npm run build           # produces dist/extension.js via foxglove-extension
npm run local-install   # installs the .foxe into your Foxglove install
```

CI runs `typecheck` + `jest` + `build` on every push and pull
request, and additionally `package`s the `.foxe` archive and uploads
it as a workflow artifact on tag pushes (`v*`).

## License

Apache-2.0. See [LICENSE](LICENSE).
