# Progress Log

This file is the project memory for future agent sessions. Update it whenever scope, design, verification, or blockers change.

## Current State

- Product name: `Computer Use for DeepSeek`.
- Product direction: local web app backed by an isolated Docker computer runtime.
- Normal user entry: configure `DEEPSEEK_API_KEY`, run `./start.sh`, use `http://localhost:3000`, stop with `./stop.sh`.
- Docker is required by the app but should remain an implementation detail for normal users.
- File handling model: upload files into an explicit run workspace, process inside the sandbox, download results from the web UI.
- The project is a git repository on branch `main`.

## Key Decisions

- The product is inspired by Anthropic Claude Computer Use but is independent and targets DeepSeek models.
- The first implementation should use a Docker-backed local web app, not a raw Docker demo.
- README files should stay user-oriented and avoid internal implementation details.
- The implementation plan uses Python/FastAPI, React/TypeScript/Vite, SQLite, Docker Compose, Xvfb/Openbox/x11vnc/noVNC, and xdotool.
- DeepSeek v4 image support is treated as uncertain; perception should remain replaceable.
- The DeepSeek tool interface should mirror Claude's demo shape with `computer`, `bash`, and `text_editor` tools.
- Normal startup should use a prebuilt runtime image; building the runtime Dockerfile is a developer workflow.

## Completed Work

- Added Claude Computer Use reference document under `reference/`.
- Wrote design spec at `docs/superpowers/specs/2026-05-17-deepseek-computer-use-design.md`.
- Wrote implementation plan at `docs/superpowers/plans/2026-05-17-deepseek-computer-use.md`.
- Added English README at `README.md`.
- Added Chinese README at `README.zh-CN.md`.
- Added lightweight harness files:
  - `AGENTS.md`
  - `feature_list.json`
  - `progress.md`
  - `init.sh`
- Implemented project scaffold:
  - backend FastAPI health endpoint and test
  - frontend React/Vite shell
  - Docker Compose wiring
  - runtime Dockerfile and initial supervisor config
  - `start.sh` and `stop.sh`
- Implemented computer action protocol:
  - `ComputerAction`
  - `Observation`
  - display validation
  - action-specific shape validation
  - protocol tests
- Implemented workspace and persistence foundation:
  - per-run workspace directories
  - upload/output folder creation
  - path escape protection
  - SQLite schema
  - session helper
  - run repository basics
- Implemented DeepSeek model adapter:
  - `computer`, `bash`, and `text_editor` tool schemas
  - response parsing into `ToolCall`
  - `reasoning_content` preservation for thinking mode
  - normalized assistant tool call serialization
- Implemented agent core and mock runtime:
  - runtime executor interface
  - mock runtime
  - safety policy
  - system prompt
  - basic agent loop with tool execution and confirmation gate
- Implemented initial Docker runtime control surface:
  - Xvfb, Openbox, x11vnc, and noVNC supervisor services
  - runtime action daemon
  - DockerRuntime HTTP client boundary
  - base64 screenshot tool results
- Implemented run and workspace API:
  - run creation
  - file upload/list/download
  - run event WebSocket connection
  - CORS wiring for the local web app
- Implemented local web console:
  - task creation form
  - workspace upload/list/download panel
  - sandbox computer iframe
  - run controls
  - timeline placeholder
- Implemented run execution controls:
  - start endpoint wired to AgentCore
  - missing DeepSeek API key guard
  - pause/resume/cancel endpoints
  - frontend run control actions
  - final text display in timeline
- Added smoke tests:
  - health endpoint smoke
  - create-run endpoint smoke
- Added lightweight audit/event trail:
  - run creation events
  - file upload events
  - start error events
  - pause/resume/cancel events
  - REST event listing
  - WebSocket event replay
  - timeline event rendering

## Latest Verification

- 2026-05-17: `./init.sh` passed.
- Output confirmed required harness and planning files are present.
- Output confirmed `feature_list.json` is valid JSON.
- Output confirmed no unresolved markers were found in harness docs.
- 2026-05-17: `docker compose config` passed after making `.env` optional in compose.
- 2026-05-17: `cd server && . .venv/bin/activate && pip install -e '.[dev]' && pytest -v` passed with 1 test.
- 2026-05-17: `cd web && npm install && npm run build` passed.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_protocol.py -v` passed with 4 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 5 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_workspace.py -v` passed with 2 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 7 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_deepseek_adapter.py -v` passed with 2 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 9 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_safety.py tests/test_agent_core.py -v` passed with 4 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 13 tests.
- 2026-05-17: `docker compose config` passed.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 13 tests after DockerRuntime changes.
- 2026-05-17: initial runtime build smoke was blocked before Docker Desktop was available; later alignment changed normal startup to use a prebuilt runtime image.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py -v` passed with 3 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 16 tests.
- 2026-05-17: `cd web && npm run build` passed after local web console changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 16 tests after web console changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py -v` passed with 5 tests after run control changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 18 tests.
- 2026-05-17: `cd web && npm run build` passed after run control changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_api_smoke.py -v` passed with 2 tests.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 20 tests.
- 2026-05-17: `cd web && npm run build` passed after smoke test addition.
- 2026-05-17: `rm -f .env && ./start.sh; code=$?; test "$code" -eq 1` passed and showed the expected setup prompt.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py -v` passed with 6 tests after audit/event changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -v` passed with 21 tests.
- 2026-05-17: `cd web && npm run build` passed after audit/event changes.
- 2026-05-17 final audit: `./init.sh` passed.
- 2026-05-17 final audit: `docker compose config` passed.
- 2026-05-17 final audit: `cd server && . .venv/bin/activate && pytest -v` passed with 21 tests.
- 2026-05-17 final audit: `cd web && npm run build` passed.
- 2026-05-17 final audit: all entries in `feature_list.json` are `done`.
- 2026-05-17 final audit before alignment changes: runtime build smoke was blocked because Docker daemon was not running.

## Next Recommended Work

1. Publish or configure the prebuilt runtime image, then run runtime smoke with `docker compose up -d runtime`.
2. Replace in-memory run state with persisted run/message/event state.
3. Keep `feature_list.json` and this progress log updated after each feature.

## Open Risks

- DeepSeek v4 direct screenshot understanding may not be available or reliable through the public API.
- Runtime container smoke now depends on a published or locally built runtime image.
- Run state and audit events are currently in-memory; persistent message history and durable audit logs remain follow-on work.

## 2026-05-17 Claude Demo Alignment Update

- Compared the design against the Anthropic quickstart and the saved Zhihu field test.
- Confirmed the overall Docker sandbox direction is correct, but adjusted the implementation path:
  - normal startup should use a prebuilt runtime image instead of building Chromium/X11 packages locally;
  - model tools should be split into `computer`, `bash`, and `text_editor`;
  - tool results should use `output`, `error`, `base64_image`, and `system`;
  - server-to-runtime execution should go through a runtime action daemon instead of running X11 commands in the server container;
  - screenshot-capable computer actions should return base64 image data for model perception.
- Updated the design spec and implementation plan with these alignment decisions.
- Implemented protocol, adapter, safety policy, mock runtime, Docker runtime client, and runtime action daemon changes.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -q` passed with 25 tests.
- 2026-05-17: `./init.sh` passed after Claude demo alignment changes.
- 2026-05-17: `docker compose config` passed.
- 2026-05-17: `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed.
- 2026-05-17: `cd web && npm run build` passed.
- 2026-05-17: `python3 -m py_compile runtime/daemon.py` passed.

## 2026-05-17 Budget Visibility and Runtime Smoke Update

- Added run usage metadata to the API:
  - steps and max steps;
  - token budget;
  - prompt, completion, and total tokens;
  - estimated cost in USD.
- Added configurable cost fields:
  - `APP_TOKEN_BUDGET`;
  - `DEEPSEEK_INPUT_USD_PER_MTOK`;
  - `DEEPSEEK_OUTPUT_USD_PER_MTOK`.
- AgentCore now stops with `token budget exceeded` when provider token usage crosses the configured budget.
- Web run controls now show step, token, and estimated cost metadata.
- Added `scripts/smoke-runtime.sh` to validate noVNC and the runtime action daemon for prebuilt or development runtime images.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -q` passed with 25 tests.
- 2026-05-17: `cd web && npm run build` passed.
- 2026-05-17: `docker compose config` passed.
- 2026-05-17: `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed.
- 2026-05-17: `bash -n scripts/smoke-runtime.sh && python3 -m py_compile runtime/daemon.py` passed.

## 2026-05-17 GitHub Runtime Image Setup

- GitHub repository selected: `https://github.com/pony-maggie/computer-use-for-deepseek`.
- Runtime image target: `ghcr.io/pony-maggie/computer-use-for-deepseek-runtime:latest`.
- Added GitHub Actions workflow at `.github/workflows/runtime-image.yml` to build and push the runtime image to GHCR.
- Because the repository is currently private, GHCR packages may also require `docker login ghcr.io` until the repo/package is made public.
- 2026-05-17: workflow YAML parse passed.
- 2026-05-17: `./init.sh` passed.
- 2026-05-17: `docker compose config` passed.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -q` passed with 25 tests.
- 2026-05-17: `cd web && npm run build` passed.

## 2026-05-17 API Cost Optimization Update

- Added DeepSeek prompt cache accounting:
  - `prompt_cache_hit_tokens`;
  - `prompt_cache_miss_tokens`.
- Kept the stable system prompt/tool-prefix path and added prompt guidance to prefer `browser_snapshot` for browser tasks when DOM/page structure is enough.
- Added screenshot hash metadata to runtime screenshot results.
- AgentCore now omits repeated screenshot `base64_image` payloads when the `image_hash` has already been sent in the same run.
- Added a `browser_snapshot` computer action backed by Chromium remote debugging metadata and bounded DOM dumping.
- Added estimated cost-budget enforcement:
  - `APP_COST_BUDGET_USD`;
  - `DEEPSEEK_INPUT_USD_PER_MTOK`;
  - `DEEPSEEK_OUTPUT_USD_PER_MTOK`.
- Added configurable model routing:
  - `DEEPSEEK_FAST_MODEL`;
  - `DEEPSEEK_PRO_MODEL`;
  - `DEEPSEEK_ROUTING`.
- Updated API run state and web controls to show model, cost budget, estimated cost, and cache hit/miss token counts.
- 2026-05-17: `cd server && . .venv/bin/activate && pytest -q` passed with 28 tests.
- 2026-05-17: `cd web && npm run build` passed.
- 2026-05-17: `./init.sh` passed.
- 2026-05-17: `docker compose config` passed.
- 2026-05-17: `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed.
- 2026-05-17: `python3 -m py_compile runtime/daemon.py && python3 -m json.tool feature_list.json` passed.

## 2026-05-22 Voice Input Visibility Fix

- Investigated why the voice feature was not obvious in the Web UI.
- Confirmed the voice input code existed and the browser-rendered UI had only a small microphone icon in the `Task` header.
- Added a visible `Voice` label next to the microphone icon and widened the button so the voice entry point is clear.
- Added a ChatPanel test that failed before the visibility fix and passes after it.
- Updated `init.sh` to require the current 2026-05-22 voice input spec and plan instead of missing 2026-05-17 plan files.
- Note: `start.sh` uses prebuilt GHCR images by default, so a user running a stale published Web image may not see local source changes until the Web image is rebuilt/published or the dev compose overlay is used.
- 2026-05-22: `cd web && npm test -- ChatPanel.test.tsx` failed before the fix because no visible `Voice` text was rendered.
- 2026-05-22: `cd web && npm test -- ChatPanel.test.tsx` passed with 8 tests after the fix.
- 2026-05-22: `cd web && npm test` passed with 33 tests.
- 2026-05-22: `cd web && npm run build` passed.
- 2026-05-22: `./init.sh` passed after updating the required plan/spec paths.
- 2026-05-22: `python3 -m json.tool feature_list.json` passed.
- 2026-05-22: DevTools browser verification at `http://127.0.0.1:3000/` showed the `Voice` button next to the task field after reload.

## 2026-05-22 Startup Simplification

- Removed the legacy local-test startup script because it was easy to confuse with the normal user startup path.
- Updated the English and Chinese README files so the user-facing startup instructions only present `./start.sh` and `./stop.sh`.
- This keeps normal startup aligned with the prebuilt-image flow and leaves local development to the explicit compose override already documented for developers.
