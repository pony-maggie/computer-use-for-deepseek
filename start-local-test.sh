#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORTS=(3000 8000 6080 5900)

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Computer Use for DeepSeek locally."
  echo "Install Docker Desktop, then run this script again."
  exit 1
fi

if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
  echo "Docker is installed but not running."
  echo "Start Docker Desktop, then run ./start-local-test.sh again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

if ! grep -q '^DEEPSEEK_API_KEY=..*' .env; then
  echo "DEEPSEEK_API_KEY is not set in .env."
  echo "Voice input and the Web UI can still be tested, but model execution will fail until the key is set."
fi

echo "Stopping existing Docker Compose services..."
docker compose down --remove-orphans

if command -v lsof >/dev/null 2>&1; then
  for port in "${PORTS[@]}"; do
    pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "Stopping process(es) listening on port ${port}: ${pids//$'\n'/ }"
      kill $pids 2>/dev/null || true
      sleep 1
      remaining="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
      if [ -n "$remaining" ]; then
        echo "Force stopping process(es) still listening on port ${port}: ${remaining//$'\n'/ }"
        kill -9 $remaining 2>/dev/null || true
      fi
    fi
  done
else
  echo "lsof is not available; skipping host port cleanup."
fi

echo "Starting local test services..."
docker compose up -d

echo "Computer Use for DeepSeek is starting. Waiting for the backend API..."
deadline=$((SECONDS + 300))
until curl -fsS http://localhost:8000/health >/dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Backend API did not become ready within 5 minutes."
    echo "Run 'docker compose logs server' to inspect startup logs."
    exit 1
  fi
  sleep 2
done

echo "Backend API is ready."
echo "Product Web UI: http://localhost:3000"
echo "Sandbox desktop: http://localhost:6080/vnc.html"
