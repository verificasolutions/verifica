# Engineering Standard

Derived from the reusable engineering portions of the supplied rule set.

## Hard constraints when the project adopts the supplied SaaS architecture
- Multi-tenant isolation is mandatory.
- Persisted domain entities use tenant/audit metadata required by the project's contract.
- Authorization decisions occur server-side; UI reflects authorization.
- Default access policy is deny-by-default.
- UI does not contain business rules.
- Expected layered flow: UI -> Service -> Repository -> DB.
- Relevant state-changing actions are auditable and emit domain events.
- Event names follow `entity.action` when this convention is adopted by the project.
- Lifecycle entities use explicit valid transitions.
- Module responsibilities remain separated.
- Do not create direct persistence access from UI.
- Do not couple modules merely for convenience.

## Agent behavior
- Follow the repository's existing architecture before applying a generic pattern.
- A project-specific `project/ARCHITECTURE.md` can narrow/override optional structural defaults, but cannot authorize security bypasses.
- Prefer simple implementation when a small SaaS does not need enterprise complexity.
- Avoid speculative abstractions.
