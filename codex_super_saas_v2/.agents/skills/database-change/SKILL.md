---
name: database-change
description: Safely modify database schema, migrations, repositories, queries, tenant isolation, RLS or persisted state.
---
# Database change
1. Load engineering + security standards and project architecture.
2. Inspect existing schema/migration/repository patterns.
3. Preserve tenant isolation, authorization boundaries and audit requirements.
4. Never weaken RLS/isolation to get a query working.
5. Use explicit migration/schema mechanisms already used by the repo.
6. Check state-machine/data-integrity consequences.
7. Run relevant migration/schema/repository checks.
8. Review for destructive behavior and cross-tenant leakage.
9. Report change, migration impact and verification.
