#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required to run Computer Use for DeepSeek locally."
  echo "Install Docker Desktop, then run this script again."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env. Add your DEEPSEEK_API_KEY, then run ./start.sh again."
  exit 1
fi

if ! grep -q '^DEEPSEEK_API_KEY=..*' .env; then
  echo "Set DEEPSEEK_API_KEY in .env before starting."
  exit 1
fi

docker compose pull
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
echo "Open http://localhost:3000"
