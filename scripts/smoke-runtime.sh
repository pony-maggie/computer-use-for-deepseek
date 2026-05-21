#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILES=(-f docker-compose.yml)
if [[ "${1:-}" == "--dev-build" ]]; then
  COMPOSE_FILES+=(-f docker-compose.dev.yml)
fi

docker compose "${COMPOSE_FILES[@]}" up -d runtime

for _ in $(seq 1 30); do
  if curl -fsS http://localhost:6080/vnc.html >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://localhost:6080/vnc.html >/dev/null

docker compose "${COMPOSE_FILES[@]}" exec -T runtime python3 - <<'PY'
import json
import urllib.request

payload = {
    "tool_call_id": "smoke",
    "name": "computer",
    "computer": {"action": "screenshot"},
}
request = urllib.request.Request(
    "http://localhost:7070/tool-call",
    data=json.dumps(payload).encode("utf-8"),
    headers={"content-type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(request, timeout=20) as response:
    result = json.loads(response.read().decode("utf-8"))

if result.get("error"):
    raise SystemExit(result["error"])
if not result.get("base64_image"):
    raise SystemExit("missing base64_image in screenshot result")
print("runtime smoke passed")
PY
