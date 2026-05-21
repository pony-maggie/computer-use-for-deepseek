#!/usr/bin/env bash
set -euo pipefail

echo "== Computer Use for DeepSeek harness init =="

required_files=(
  "AGENTS.md"
  "feature_list.json"
  "progress.md"
  "README.md"
  "README.zh-CN.md"
  "docs/superpowers/specs/2026-05-17-deepseek-computer-use-design.md"
  "docs/superpowers/plans/2026-05-17-deepseek-computer-use.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file"
    exit 1
  fi
done

echo "Required harness and planning files are present."

if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool feature_list.json >/dev/null
  echo "feature_list.json is valid JSON."
else
  echo "python3 not found; skipped feature_list.json validation."
fi

if command -v rg >/dev/null 2>&1; then
  if rg -n "TBD:|TODO:|IMPLEMENT_LATER|PLACEHOLDER" AGENTS.md progress.md feature_list.json README.md README.zh-CN.md docs/superpowers >/tmp/computer-use-harness-scan.txt; then
    echo "Found unresolved marker text:"
    cat /tmp/computer-use-harness-scan.txt
    exit 1
  fi
  echo "No unresolved markers found in harness docs."
else
  echo "rg not found; skipped placeholder scan."
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Git status:"
  git status --short
else
  echo "Not a git repository; skipping git status."
fi

echo "Harness init complete."
