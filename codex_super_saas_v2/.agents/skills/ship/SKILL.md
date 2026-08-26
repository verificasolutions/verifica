---
name: ship
description: Perform final pre-ship verification of a completed change: inspect diff, run appropriate repository-defined checks and surface blockers before declaring done.
---
# Ship
1. Inspect git diff/status.
2. Discover exact verification scripts from the repository.
3. Run the narrowest complete relevant set: typecheck/lint/tests/build as appropriate.
4. Do not invent missing scripts.
5. Confirm no unintended files/secrets/debug artifacts are present.
6. Confirm migrations/config changes are deliberate.
7. If checks fail, report and fix only when within requested scope.
8. Final output: PASS or BLOCKED, checks executed, blockers.
