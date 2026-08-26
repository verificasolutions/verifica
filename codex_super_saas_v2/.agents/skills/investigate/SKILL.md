---
name: investigate
description: Investigate an unknown bug, unexpected behavior, failure, regression, performance issue, or confusing code path before changing code. Use when the root cause is not yet known.
---
# Investigate
1. Inspect the exact symptom/error and reproduce if possible.
2. Trace only the smallest relevant path first.
3. Search for a working analogue in the repository.
4. Read `agent-system/CONTEXT_ROUTER.md`; load only required context.
5. Do not edit code until there is a supported root-cause hypothesis.
6. Distinguish root cause from downstream symptoms.
7. Return a concise diagnosis and the minimal proposed fix.
8. If explicitly asked to fix it too, continue with the `fix-bug` workflow.
