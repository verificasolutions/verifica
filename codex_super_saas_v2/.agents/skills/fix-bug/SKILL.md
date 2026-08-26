---
name: fix-bug
description: Fix a confirmed localized bug, compile/type error, runtime error, regression, or failing test using the smallest safe change.
---
# Fix bug
1. Confirm the failure/root cause; use investigate if not known.
2. Load only routed context.
3. Apply the smallest correct fix.
4. Do not refactor unrelated code.
5. Run the narrowest relevant verification.
6. Review the diff for regressions and accidental scope.
7. Report: cause, change, verification, remaining risk.
