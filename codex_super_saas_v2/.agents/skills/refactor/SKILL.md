---
name: refactor
description: Improve code structure, duplication or maintainability while preserving externally observable behavior unless behavior change is explicitly requested.
---
# Refactor
1. Define what must remain behaviorally identical.
2. Inspect tests and callers before editing.
3. Load only relevant architecture standard.
4. Make incremental structural changes.
5. Do not mix feature work into the refactor.
6. Keep public/API contracts stable unless explicitly in scope.
7. Run focused tests/checks after each risky step.
8. Review diff for accidental behavior change.
