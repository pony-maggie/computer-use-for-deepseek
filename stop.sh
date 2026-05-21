#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not available. Nothing was stopped."
  exit 0
fi

docker compose down
echo "Computer Use for DeepSeek has stopped."
