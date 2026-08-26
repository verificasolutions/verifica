# Security Standard

Derived from the reusable security portions of the supplied rule set.

- Preserve tenant isolation.
- Never weaken RLS or equivalent row/data isolation to fix an error.
- Validate permissions/authorization server-side.
- Protect sensitive values; do not introduce plaintext storage for secrets/payment credentials.
- Preserve auditability for security-sensitive and state-changing operations.
- Preserve rate limiting where the affected surface requires it.
- Do not expose internal errors, credentials or cross-tenant data to clients.
- Treat session/authentication changes as high risk and verify them explicitly.
- Destructive data changes require deliberate handling; prefer the project's established soft-delete/retention policy.
- Security fixes outrank convenience and UI behavior.
