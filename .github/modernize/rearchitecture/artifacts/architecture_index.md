# SchoolPlans — Implementation Guide

This index is not the full contract. Do not implement from this file alone; follow the listed artifact paths before implementation.

## Global artifacts

- `unit_graph.yaml` — all workers: single existing HTML document and externally triggerable page boundary; source anchors are evidence, not rewrite scope.
- `migration_boundary.yaml` — all workers: exact incremental implementation scope. Read `must_rewrite`, `copy_as_is` and `legacy_allowed_to_remain`.
- `wire_contracts.yaml` — workers touching Supabase/RPC/Edge Function/Storage: preserve observed SDK call families; no server schema is asserted.
- `shared_modules.yaml` — workers using shared code: currently empty because the analyzed runtime is one HTML/script unit; do not infer module ownership from target folders.
- `cross_unit_state.yaml` — workers changing session or centre state: currently no cross-unit rows; state within this single UI runtime is documented in its behavior/bindings.
- `seams.yaml` — all workers: the legacy HTML is an authoritative frozen reference; do not refactor it during the React bootstrap.
- `project-structure.md`, `tech-stack.md`, `data-model.md` — all workers: global observed domain boundaries, existing runtime/dependencies, and data names/relations.

## Implementation Guide

### Unit: `schoolplans-spa`

- External trigger: browser loads the single-page HTML; internal tabs are DOM state, not URL routes.
- Read `units/schoolplans-spa/behavior.yaml` for side effects, role-dependent branches, validations, calculation behavior and errors.
- Read `units/schoolplans-spa/bindings.yaml` for CDN/client wiring, browser storage, RPC/Edge Function and Storage bindings.
- Read `units/schoolplans-spa/unit_decomposition.yaml` for advisory split candidates only (`commit: false`).
- Filter `wire_contracts.yaml` where `unit: schoolplans-spa`; filter `shared_modules.yaml` by `used_by_units` (currently none); filter `cross_unit_state.yaml` by writer/reader (currently none); filter seams by `cut_between` including `schoolplans-spa`.
- Read `migration_boundary.yaml` for permitted implementation files. Do not treat `legacy/vntest.html` as a rewrite target.
- Before DONE, report these artifact paths read, each implemented `must_preserve` behavior, unresolved Supabase contracts and evidence from lint/build/tests/runtime.

## Source and evidence

The requested path `reference/vntest(2).html` is absent. The supplied source used is `legacy/vntest.html` (9,326 lines). Supabase server definitions and live configuration were not available.
