# Changelog

All notable changes to `semantic-toponav-foxglove-panel` are recorded in
this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the extension uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-05-28

### Added

- Third panel — `Semantic TopoNav Resolve`. Subscribes to
  `/resolve_trace` and decodes the v1 `ResolveTrace` wire format
  (`LLMResolveResult.to_dict` from the upstream resolver). Renders
  the final candidate ranking joined against the deterministic
  baseline so the LLM rewrite is legible at a glance — every row
  shows its `rank → base_rank` movement with an arrow / color and
  the LLM-picked row is highlighted. Surfaces `pick_status`
  (`llm_pick` / `fallback` / `clarification_pending` / `no_pick`),
  the LLM's picked node id, the one-line `llm_reason`, and the
  `embedding_score` column when a `query_encoder` was supplied
  upstream. When the resolver emits a `clarification`, the question
  + its candidate set are rendered in a separate band above the
  main table. Completes per-wire-format panel coverage of the v1
  schemas (FleetPlanResult / ConflictExplanation / ResolveTrace).
- `src/resolve.ts` — pure data transform paired with the panel.
  Builds `ResolveView` from `ResolveTrace`: per-candidate
  `ResolveRow` with rank, base_rank lookup, embedding_score
  attach, and an `is_llm_pick` flag. `normalizeResolveTrace`
  validates the v1 required-fields set and rejects payloads that
  are missing fields or have non-array candidates, so the panel
  surfaces a parse error rather than rendering garbage.
- jest unit tests for the resolve transform covering all four
  `pick_status` paths (no_pick / llm_pick / fallback /
  clarification_pending), partial embedding-score coverage, the
  base_rank-not-found edge case, and the normalize validation
  paths.

### Changed

- CI now also runs `npm run build` on every push / pull request, and
  on tag pushes (`v*`) additionally runs `npm run package` and
  uploads the resulting `.foxe` archive as a workflow artifact.
  Closes the v0.1.0 deferred follow-up around build-parity in CI.
- Actions bumped to Node.js 24 runtime — `actions/checkout@v4 ->
  @v6`, `actions/setup-node@v4 -> @v5` (with `node-version: "22"`,
  cache: npm). Switched `npm install` to `npm ci` so CI installs
  exactly the locked dependency tree.

## [0.2.0] — 2026-05-18

### Added

- Second panel — `Semantic TopoNav Conflicts`. Subscribes to
  `/conflict_explanations` and decodes the v1 `ConflictExplanation`
  wire format in either of two shapes the upstream bridges emit:
  a JSON array of records (typical bnb-scheduler batch) or a single
  record (typical rosbridge-style per-message form). Renders a
  count-by-`reason_code` summary band plus a row-per-conflict table
  with `blocked_agent_id`, `blocking_agents`, `blocking_resources`,
  and `detail`. Reason badges follow the same color palette as
  `SemanticTopoNavPanel` so a Conflicts panel sits beside the
  Fleet panel without a palette clash.
- `src/conflicts.ts` — pure data transform paired with the panel.
  Sorts conflicts by `reason_code` then `blocked_agent_id` and emits
  per-reason counters; `normalizeConflicts` accepts either a single
  record or an array and rejects anything else with a parse-time
  error so the panel can surface a clear diagnostic instead of
  rendering garbage.
- jest unit tests for the conflicts transform covering empty inputs,
  the sort order, per-reason counts, and the array / single-record /
  invalid normalization paths.

## [0.1.0] — 2026-05-17

Initial scaffold landing.

### Added

- `SemanticTopoNavPanel` Foxglove extension panel — subscribes to
  `/fleet_plan_result`, decodes the
  `FleetPlanResult` v1 wire format (JSON-serialized either inline or
  inside a `data` field on a schemaless message), and renders a
  per-agent Gantt of `claims` plus a status table colored by
  `reason_code` (`ok` / `no_path` / `deadline_miss` /
  `reservation_conflict` / `policy_rejected`).
- `src/gantt.ts` — pure data transform from `FleetPlanResult` to
  `GanttView`, kept separate from the panel so it can be unit-tested
  without the Foxglove extension API. Midnight-wrapping reservations
  (`end <= start`) are detected and flagged for split rendering.
- `src/types.ts` — TypeScript mirror of the v1-locked JSON schemas
  (`Reservation`, `PlanWithSchedulerResult`, `FleetPlanResult`,
  `ConflictExplanation`, `ReasonCode`).
- jest unit tests for the Gantt transform covering empty fleets,
  granted / rejected rows, and midnight-wrapping bars.
- CI: GitHub Actions on Node 20 running `npm install`, `tsc --noEmit`,
  and jest. The Foxglove extension bundle (`foxglove-extension build`)
  is intentionally deferred to a follow-up — the toolchain dependency
  resolution is iterated separately from the TypeScript correctness
  gate.

### Deferred

- `foxglove-extension build` / packaging end-to-end in CI — the v0.1.0
  scaffold gates on typecheck + unit tests only. Tracked as a
  follow-up issue.
- ESLint setup (`@foxglove/eslint-plugin`) — same reason; the
  TypeScript strict mode + tsc already gives the v0.1.0 floor.

### Depends on

- Schema contract: `FleetPlanResult` v1 + `PlanWithSchedulerResult`
  v1 from
  [`semantic-toponav`](https://github.com/rsasaki0109/semantic-toponav)
  ([JSON Schema](https://github.com/rsasaki0109/semantic-toponav/blob/main/schemas/fleet_plan_result_v1.schema.json)).
  Compatible with upstream tags `>= v1.0.0`; a v2 schema bump in the
  upstream wire format would require a matching major bump here.
