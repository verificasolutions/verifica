---
name: review
description: Independently review a diff, commit, branch or implementation for material defects, regressions, SaaS architecture/security problems and missing verification.
---
# Review
1. Review the exact changed scope.
2. Load only relevant standards.
3. Prioritize findings:
   a. correctness/regressions
   b. tenant/security/data leakage
   c. permissions
   d. data/state integrity
   e. architecture/layering
   f. tests/verification
   g. maintainability with concrete impact
4. Ignore cosmetic style already enforced by tooling unless material.
5. Separate confirmed defects from risks.
6. Cite file/line where possible.
7. If there are no material findings, say so.
