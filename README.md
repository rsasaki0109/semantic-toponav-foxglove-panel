# semantic-toponav-foxglove-panel

[Foxglove](https://foxglove.dev/) extension panel that visualizes the
v1-locked wire formats produced by
[`semantic-toponav`](https://github.com/rsasaki0109/semantic-toponav)
— a multi-agent semantic-topological planning layer.

The v0.1.0 scaffold ships **one** panel:

- **Semantic TopoNav Panel** — subscribes to `/fleet_plan_result`,
  decodes the `FleetPlanResult` v1 payload, and draws a per-agent
  reservation Gantt plus a `reason_code`-colored status table. Granted
  agents and denied agents are visually separated; midnight-wrapping
  reservations (`end <= start`) are detected and rendered as two
  segments.

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

| Topic                  | Payload                                                                  |
|------------------------|--------------------------------------------------------------------------|
| `/fleet_plan_result`   | JSON-serialized `FleetPlanResult` (either as a string or as a `data` field on a schemaless message). |

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

`foxglove-extension build` / packaging end-to-end is **not** gated by
CI at v0.1.0 — the scaffold's CI gate is typecheck + jest. Build
parity is tracked as a follow-up.

## License

Apache-2.0. See [LICENSE](LICENSE).
