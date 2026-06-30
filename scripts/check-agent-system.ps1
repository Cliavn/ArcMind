$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$required = @(
  'AGENTS.md',
  'README.md',
  'docs/agent/00-index.md',
  'docs/agent/01-project-overview.md',
  'docs/agent/02-architecture.md',
  'docs/agent/03-tech-stack.md',
  'docs/agent/04-decisions.md',
  'docs/agent/quality.md',
  'docs/agent/review.md',
  'docs/agent/design-system.md',
  'docs/agent/design-ops.md',
  'docs/agent/task-report-template.md',
  'docs/agent/modules/_template.md',
  'docs/agent/modules/agent-system.md',
  'docs/agent/modules/main-process.md',
  'docs/agent/modules/frontend.md',
  'docs/agent/modules/visual-system.md',
  'docs/agent/modules/ai-runtime.md',
  'docs/agent/modules/voice-runtime.md',
  'docs/agent/modules/memory-storage.md',
  'docs/agent/modules/security.md',
  'docs/agent/workflows/new-feature.md',
  'docs/agent/workflows/bug-fix.md',
  'docs/agent/workflows/refactor.md',
  'docs/agent/workflows/performance.md',
  'docs/agent/workflows/ui-change.md',
  'docs/agent/workflows/model-integration.md',
  'docs/agent/workflows/version-control.md',
  'docs/agent/checklists/new-feature-checklist.md',
  'docs/agent/checklists/bug-fix-checklist.md',
  'docs/agent/checklists/refactor-checklist.md',
  'docs/agent/checklists/review-checklist.md',
  'docs/agent/checklists/ui-change-checklist.md',
  'docs/agent/checklists/version-control-checklist.md'
)

$missing = @()
foreach ($path in $required) {
  $fullPath = Join-Path $root $path
  if (-not (Test-Path -Path $fullPath)) {
    $missing += $path
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Missing AGENT files:`n" + ($missing -join "`n"))
}

Write-Output "AGENT system check passed. $($required.Count) files present."
