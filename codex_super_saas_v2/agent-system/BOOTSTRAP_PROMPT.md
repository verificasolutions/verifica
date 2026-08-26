# Bootstrap Prompt

Execute this bootstrap inside the current repository. Do not only explain.

1. Read root `AGENTS.md`.
2. If `AGENTS.CANDIDATE.md` exists, compare it with the existing `AGENTS.md` and merge the useful universal rules while preserving repository-specific commands/conventions. Then remove the candidate.
3. Read `agent-system/CONTEXT_ROUTER.md`.
4. Inspect repository structure, package/lock files, README, scripts and CI configuration.
5. Fill `agent-system/project/ARCHITECTURE.md` with factual information discovered from the repository. Do not guess missing architecture.
6. Fill `agent-system/project/CURRENT.md` only with facts that can be established from the repository/current task.
7. Do not invent product requirements. Leave `PRODUCT.md` placeholders untouched unless product requirements already exist in the repository.
8. Search for existing project rules/docs. Reference them from the project files rather than duplicating large texts.
9. Verify the eight skills under `.agents/skills/` are visible/discoverable to Codex.
10. Do not change product code during bootstrap.
11. Do not spawn subagents for this bootstrap.
12. Final response: only files changed, what was discovered, and any missing information that would materially improve future coding.
