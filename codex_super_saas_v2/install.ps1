param(
  [string]$Repo = "."
)
$ErrorActionPreference = "Stop"
$Pack = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = (Resolve-Path $Repo).Path
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Backup-IfExists($Path) {
  if (Test-Path $Path) {
    Copy-Item $Path "$Path.backup-$Stamp" -Recurse -Force
    Write-Host "Backup: $Path.backup-$Stamp"
  }
}

Write-Host "Installing Codex Super SaaS into: $Repo"

# AGENTS: don't overwrite an existing one; install candidate for Codex to merge.
$targetAgents = Join-Path $Repo "AGENTS.md"
if (Test-Path $targetAgents) {
  $candidate = Join-Path $Repo "AGENTS.CANDIDATE.md"
  Copy-Item (Join-Path $Pack "AGENTS.md") $candidate -Force
  Write-Host "Existing AGENTS.md preserved. Candidate created: AGENTS.CANDIDATE.md"
} else {
  Copy-Item (Join-Path $Pack "AGENTS.md") $targetAgents -Force
  Write-Host "Created AGENTS.md"
}

# Agent system
$targetSystem = Join-Path $Repo "agent-system"
Backup-IfExists $targetSystem
Copy-Item (Join-Path $Pack "agent-system") $targetSystem -Recurse -Force
Write-Host "Installed agent-system/"

# Skills
$targetSkills = Join-Path $Repo ".agents\skills"
New-Item -ItemType Directory -Force -Path $targetSkills | Out-Null
Get-ChildItem (Join-Path $Pack ".agents\skills") -Directory | ForEach-Object {
  $dest = Join-Path $targetSkills $_.Name
  if (Test-Path $dest) {
    Copy-Item $dest "$dest.backup-$Stamp" -Recurse -Force
  }
  Copy-Item $_.FullName $dest -Recurse -Force
}
Write-Host "Installed 8 skills into .agents/skills/"

# Initialize project files only if absent
$projectDir = Join-Path $targetSystem "project"
New-Item -ItemType Directory -Force -Path $projectDir | Out-Null
Get-ChildItem (Join-Path $targetSystem "project-template") -File | ForEach-Object {
  $dest = Join-Path $projectDir $_.Name
  if (-not (Test-Path $dest)) { Copy-Item $_.FullName $dest }
}
New-Item -ItemType Directory -Force -Path (Join-Path $projectDir "modules") | Out-Null

Write-Host ""
Write-Host "DONE."
Write-Host "Next: open Codex in this repo and send:"
Write-Host 'Read AGENTS.md and agent-system/BOOTSTRAP_PROMPT.md. Execute the bootstrap now.'
