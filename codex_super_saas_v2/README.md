# Codex Super SaaS V2

Universal coding-agent system for creating, editing, debugging and reviewing different SaaS projects.

## Windows
Extract this folder anywhere, open PowerShell in it and run:

`powershell -ExecutionPolicy Bypass -File .\install.ps1 -Repo "C:\CAMINHO\DO\SEU\PROJETO"`

Then open Codex in the project and send:

`Read AGENTS.md and agent-system/BOOTSTRAP_PROMPT.md. Execute the bootstrap now.`

## macOS/Linux
`./install.sh /path/to/project`

Then run the same bootstrap prompt.

## What gets installed
- root `AGENTS.md` (or `AGENTS.CANDIDATE.md` if you already have one)
- `.agents/skills/` with 8 engineering workflows
- `agent-system/CONTEXT_ROUTER.md`
- reusable standards
- per-project context templates
- exact preserved copies of the original 16 rules

Existing `agent-system/` and same-named skills are backed up before replacement.
