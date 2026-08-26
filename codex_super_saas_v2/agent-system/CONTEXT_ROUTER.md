# CONTEXT ROUTER

Goal: load the minimum context needed to make the current change correctly.

## Always
`AGENTS.md` is the global operating contract. Do not reload source-rule documents simply to restate it.

## Bug / error
Read:
- failing file(s)
- nearest callers/dependencies
- `standards/engineering.md` only if architecture/layering is involved
- `standards/security.md` only if auth/tenant/data/security is involved
- affected project/domain file only if behavior is unclear

Use skill: `investigate` first when root cause is unknown; then `fix-bug`.

## New feature
Read:
- `project/PRODUCT.md`
- `project/ARCHITECTURE.md`
- affected file under `project/modules/` if present
- only relevant standard(s)

Use skill: `implement-feature`.

## UI / visual work
Read:
- `standards/ui-ux.md`
- affected screen/components
- affected project/domain file only for semantics/actions

Use skill: `ui-visual`.

Do not load finance/support/AI/etc. merely because they exist.

## Database / persistence / RLS
Read:
- `standards/engineering.md`
- `standards/security.md`
- `project/ARCHITECTURE.md`
- affected domain/module spec

Use skill: `database-change`.

## Refactor
Read:
- affected code
- `standards/engineering.md`
- relevant module/project docs

Use skill: `refactor`.
Behavior preservation is mandatory unless the user explicitly requests behavior changes.

## Review
Read:
- exact diff/commit/files
- only standards relevant to changed code

Use skill: `review`.

## Final verification / release readiness
Read:
- repository scripts/CI configuration
- changed files/diff
- relevant verification standard

Use skill: `ship`.

## AI inside the SaaS
Only when implementing the product's own AI/operator behavior, read:
- `source-rules/13-AI-MASTER-PROMPT.md`
- `source-rules/14-RESPONSE-TEMPLATE.md`
- `source-rules/15-VALIDATION-CHECKLIST.md`

These are NOT general Codex behavior rules.

## Legacy/source rules
`source-rules/` preserves the original 16 documents.
Use them to resolve a requirement, audit the framework, or bootstrap a new project's specific rules.
They are reference material, not default context.

## Conflict rule
If code, project docs and standards materially conflict:
1. do not silently guess;
2. preserve security/data integrity;
3. make the smallest reversible change possible;
4. report the exact conflict.
