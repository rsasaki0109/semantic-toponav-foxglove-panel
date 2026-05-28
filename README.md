# semantic-toponav-foxglove-panel

[Foxglove](https://foxglove.dev/) extension panel that visualizes the
v1-locked wire formats produced by
[`semantic-toponav`](https://github.com/rsasaki0109/semantic-toponav)
— a multi-agent semantic-topological planning layer.

As of v0.2.0 the extension ships **two** panels:

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

## Wire format

The panel decodes the JSON Schemas locked in `semantic-toponav` at
`v1.0.0`:

- [`FleetPlanResult`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/fleet_plan_result_v1.schema.json)
- [`PlanWithSchedulerResult`](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/plan_with_scheduler_result_v1.schema.json)

The TypeScript mirror lives in `src/types.ts`. The pure data transform
from `FleetPlanResult` to Gantt rows lives in `src/gantt.ts` and is
unit-tested under `src/__tests__/`.

Compatible with upstream `>= v1.0.0`. A v2 schema bump upstream would
require a matching major bump here.

## Topic conventions

| Topic                      | Payload                                                                                                    |
|----------------------------|------------------------------------------------------------------------------------------------------------|
| `/fleet_plan_result`       | JSON-serialized `FleetPlanResult` (either as a string or as a `data` field on a schemaless message).       |
| `/conflict_explanations`   | JSON-serialized `ConflictExplanation[]` or a single `ConflictExplanation`. Inline string or `data` field.  |

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
