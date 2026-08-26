#!/usr/bin/env bash
set -euo pipefail
REPO="${1:-.}"
PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$REPO" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

echo "Installing Codex Super SaaS into: $REPO"

if [ -f "$REPO/AGENTS.md" ]; then
  cp "$PACK/AGENTS.md" "$REPO/AGENTS.CANDIDATE.md"
  echo "Existing AGENTS.md preserved. Candidate created."
else
  cp "$PACK/AGENTS.md" "$REPO/AGENTS.md"
fi

if [ -d "$REPO/agent-system" ]; then
  cp -R "$REPO/agent-system" "$REPO/agent-system.backup-$STAMP"
fi
rm -rf "$REPO/agent-system"
cp -R "$PACK/agent-system" "$REPO/agent-system"

mkdir -p "$REPO/.agents/skills"
for src in "$PACK"/.agents/skills/*; do
  name="$(basename "$src")"
  if [ -d "$REPO/.agents/skills/$name" ]; then
    cp -R "$REPO/.agents/skills/$name" "$REPO/.agents/skills/$name.backup-$STAMP"
    rm -rf "$REPO/.agents/skills/$name"
  fi
  cp -R "$src" "$REPO/.agents/skills/$name"
done

mkdir -p "$REPO/agent-system/project/modules"
for src in "$REPO"/agent-system/project-template/*.md; do
  name="$(basename "$src")"
  [ -f "$REPO/agent-system/project/$name" ] || cp "$src" "$REPO/agent-system/project/$name"
done

echo "DONE."
echo "Next prompt:"
echo "Read AGENTS.md and agent-system/BOOTSTRAP_PROMPT.md. Execute the bootstrap now."
