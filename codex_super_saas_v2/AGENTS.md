# AGENTS.md — Universal SaaS Coding Agent

## Mission
Create, edit, debug, review and ship SaaS code with minimum unnecessary context and minimum unrelated change.

## Operating rules
- Inspect existing code before inventing architecture or components.
- Prefer the smallest correct change.
- Do not refactor unrelated code.
- Reuse existing patterns, components and utilities before creating new ones.
- Never bypass security, tenant isolation, permissions or validation to make code pass.
- Keep business logic out of presentation/UI code.
- Keep data access behind the repository/data layer used by the project.
- Preserve module/layer boundaries used by the repository.
- For lifecycle entities, preserve explicit valid state transitions.
- Preserve required audit logs and domain events.
- Treat the backend/server as the authorization source of truth.
- Do not add a production dependency unless the task truly requires it.
- Discover build/test/lint commands from the repository; never invent them.

## Context discipline
Before non-trivial work, read `agent-system/CONTEXT_ROUTER.md`.
Load only the standards/project files routed for the current task.
Do not read all `agent-system/source-rules/` unless explicitly auditing the rules themselves.

## Work modes
Use the matching skill when applicable:
- investigate: find cause without changing code prematurely
- fix-bug: minimal bug correction
- implement-feature: scoped feature delivery
- ui-visual: visual/interface refinement
- database-change: schema/query/RLS/persistence work
- refactor: structural improvement with behavior preservation
- review: independent quality review
- ship: final verification before considering work done

## Verification
After edits:
1. run the narrowest relevant checks first;
2. expand checks only when scope/risk requires it;
3. review the final diff;
4. report checks that could not be run.

## Response format
Keep coding responses short:
- Changed
- Verified
- Risk/blocker (only if one exists)

Do not use the product runtime AI response template for ordinary coding work.

## Token / usage discipline
- Do not spawn subagents by default.
- Do not perform broad repository exploration for a localized task.
- Do not reread documents already summarized in active context unless needed.
- Do not generate long plans for obvious localized fixes.
- Use parallel/subagent work only when independent exploration materially outweighs the extra token cost.
