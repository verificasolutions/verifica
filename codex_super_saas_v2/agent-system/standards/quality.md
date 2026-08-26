# Code Quality & Verification Standard

- Prefer correctness and maintainability over cleverness.
- Avoid broad rewrites for local tasks.
- Avoid duplicate abstractions; search for existing equivalents.
- Do not hide type errors with unsafe escape hatches unless the project explicitly requires one and the reason is documented.
- Do not mark work complete without relevant verification.
- Run targeted checks before expensive broad checks.
- Review the final diff for accidental edits.
- Separate confirmed defects from speculative improvements.
- A review should prioritize: correctness, security/tenant isolation, data integrity, permissions, regression risk, architecture, tests, then style.
