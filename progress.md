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
- Implemented sandbox-first workbench redesign:
  - captured layout issue where long task and approval content pushed the sandbox below the first viewport
  - wrote `docs/superpowers/specs/2026-05-24-sandbox-first-workbench-design.md`
  - moved the product to a three-column setup/sandbox/inspector layout
  - constrained long task text and moved live run supervision into the right inspector rail
- Implemented Simplified Workbench v2:
  - collapsed templates and references behind a task assistance disclosure
  - collapsed advanced run controls and workspace upload behind run settings
  - replaced the always-stacked right rail with Overview, Steps, Files, and Debug tabs
  - moved history/replay/debug surfaces out of the default view
- Implemented bilingual interface and voice-language alignment:
  - global Chinese/English interface language switch
  - voice recognition language follows the interface language
  - removed the separate voice language selector to avoid confusing it with app language
  - localized core panels, templates, scenario packs, run controls, audit/report surfaces, operations, artifacts, references, workspace, replay, and approvals
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

- 2026-05-24: `cd web && npm run build` passed after sandbox-first workbench redesign.
- 2026-05-24: Browser E2E on `http://127.0.0.1:3000/` at 1440x900 confirmed idle, long-task, running, and completed/canceled states keep the sandbox stage fixed in the first viewport. Measured sandbox iframe remained at `722x862`, `top=19`, `bottom=881`; document body stayed `900px` high while the inspector rail scrolled independently.
- 2026-05-24: Browser E2E created and ran a long Chinese task against `https://example.com`; the run reached Example Domain with `3 steps`, `41487 tokens`, and `21504 cache-hit tokens`, then was canceled after completion during cleanup.
- 2026-05-24: Browser E2E at 1180x900 confirmed the responsive layout keeps setup and sandbox in a fixed 720px top row, with the inspector below instead of hidden by overflow.
- 2026-05-24: `cd web && npm run build` passed after Simplified Workbench v2.
- 2026-05-24: Browser E2E on `http://127.0.0.1:3000/` at 1440x900 confirmed the simplified default view only shows the task composer, two collapsed setup disclosures, sandbox stage, run controls, monitor tabs, and Overview artifacts. Steps and Debug tabs render their dense panels without overlap; Debug tab content scrolls within the right rail.
- 2026-05-25: Investigated a screenshot showing Steps tab overlap in the right rail. Root cause was `RunInspector` sections sharing one narrow flow without explicit section boundaries. Added per-section cards and local scroll constraints for Audit Trail, Step Details, and Run Report. `cd web && npm run build` passed. Browser E2E on the completed `run_2296929ec76e442db01b9e805872b50f` confirmed the three inspector sections no longer overlap.
- 2026-05-24: `./start.sh` pulled latest GHCR server/web/runtime images after GitHub Actions run `26358293933` succeeded.
- 2026-05-24: Local acceptance smoke on latest images passed for `docker compose ps`, `./scripts/smoke-runtime.sh`, health endpoint, noVNC HTTP, multilingual UI switching, templates, scenario packs, workflow notes, viewport lab, reference upload, run creation/start/completion, run report, artifacts, replay, benchmark marking, API run creation, runtime screenshot, and runtime browser_snapshot.
- 2026-05-24: Local acceptance found safety gap: `echo -n "hello acceptance" > /workspace/hello.txt` was treated as low-risk bash. Added failing safety test and fixed `SafetyPolicy` to reject unsafe shell redirection tokens in low-risk read commands.
- 2026-05-24: `cd server && . .venv/bin/activate && pytest tests/test_safety.py::test_echo_redirection_requires_confirmation -v` passed after safety fix.
- 2026-05-24: `cd server && . .venv/bin/activate && pytest tests/test_safety.py -v` passed with 17 tests after safety fix.
- 2026-05-24: `cd server && . .venv/bin/activate && pytest -v` passed with 69 tests after safety fix.
- 2026-05-24: `cd web && npm test` passed with 53 tests after safety fix.
- 2026-05-24: `cd web && npm run build` passed after safety fix.
- 2026-05-24: `python3 -m json.tool feature_list.json >/dev/null && ./init.sh` passed after safety fix.
- 2026-05-24: `cd web && npm test -- i18n.test.tsx ChatPanel.test.tsx ApprovalPreview.test.tsx RunControls.test.tsx RunHistoryPanel.test.tsx RunInspector.test.tsx` passed with 18 tests.
- 2026-05-24: `cd web && npm run build` passed after bilingual UI changes.
- 2026-05-24: Browser E2E on `http://localhost:5173/` confirmed Chinese default UI, English switch, `document.documentElement.lang === "en-US"` after switching, voice hint follows interface language, and no `Voice language` / `语音语言` selector text remains.
- 2026-05-24: `cd web && npm test` passed with 53 tests after bilingual UI changes.
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
- Invisible memory must remain conservative: it should not store uploaded file contents, credentials, screenshots, DOM dumps, one-off webpage facts, or detailed task traces.

## 2026-05-25 Invisible Memory Planning

- User approved a fully invisible memory direction: no Web UI surface, no normal user-facing controls, and no detailed per-task transcript storage.
- Added design spec: `docs/superpowers/specs/2026-05-25-invisible-memory-design.md`.
- Added architecture diagram source: `docs/memory-architecture.html`.
- Rendered architecture screenshot: `docs/images/memory-architecture.png`.
- Added English and Chinese README preview sections that describe invisible memory as planned work, not shipped behavior.
- Added implementation plan: `docs/superpowers/plans/2026-05-25-invisible-memory.md`.
- Added `feat-032` to `feature_list.json` with status `planned`.
- Verification for this planning/doc pass:
  - `python3 -m json.tool feature_list.json >/dev/null` passed.
  - Targeted `rg` checks confirmed the English/Chinese README image references, new docs, and `feat-032` entries.
  - Placeholder scan over the new memory docs and README found no unresolved markers.
  - `./init.sh` passed.

## 2026-05-25 Invisible Memory Implementation

- Implemented `feat-032` as a backend-only memory layer:
  - added `MemoryRecord` persistence and `MemoryRepository`;
  - added deterministic `MemoryService` capture, filtering, ranking, and hidden context formatting;
  - added `AgentCore.memory_context` injection into the model input;
  - wired memory recall into `_build_agent`;
  - wired terminal run capture into `_apply_run_result`;
  - kept run API responses free of memory fields or `Memory Context` text.
- Updated English and Chinese README sections from planned to implemented invisible memory.
- Verification:
  - `cd server && . .venv/bin/activate && pytest -v` passed with 81 tests.
  - `cd web && npm test` passed with 54 tests.
  - `cd web && npm run build` passed.
  - `docker compose config` passed.
  - `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed.
  - `python3 -m py_compile runtime/daemon.py` passed.
  - `python3 -m json.tool feature_list.json >/dev/null` passed.
  - `./scripts/smoke-runtime.sh` passed.

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

## 2026-05-22 Fresh Image Startup Fix

- Updated `start.sh` to run `docker compose pull` before `docker compose up -d`, so the normal startup path fetches the latest published images instead of reusing stale local cache.
- Added a short note to the English and Chinese README files explaining that startup now pulls the latest published images before launching services.

## 2026-05-22 Voice Locale Fix

- Changed browser voice input to default to `zh-CN` when the browser language starts with `zh`, otherwise `en-US`.
- Added regression coverage for Chinese browser locale detection in the voice input hook.
- Verified with `cd web && npm test` and `cd web && npm run build` after the change.

## 2026-05-24 Visual Run Inspector Planning

- Reviewed local references saved under `~/Documents/temp`, including Gemini 2.5 Computer Use screenshots and saved Computer Use / Browser Use articles.
- Reviewed `nexu-io/open-design` as a product interaction reference, especially structured question forms, live task/tool streams, sandboxed previews, artifact-first output, and checklist-style review.
- Proposed the next feature as `Visual run inspector and action preview`.
- Drafted the design spec at `docs/superpowers/specs/2026-05-24-visual-run-inspector-design.md`.
- Added `feat-023` to `feature_list.json` with status `planned`.
- User approved the design direction.
- Drafted the implementation plan at `docs/superpowers/plans/2026-05-24-visual-run-inspector.md`.
- Implemented structured backend run events, stable event API serialization, frontend event view helpers, `ComputerOverlay`, `RunInspector`, `ApprovalPreview`, and completion report metrics.
- Updated `feat-023` to `done`.
- 2026-05-24: `cd server && . .venv/bin/activate && pytest -v` passed with 68 tests.
- 2026-05-24: `cd web && npm test` passed with 52 tests.
- 2026-05-24: `cd web && npm run build` passed.
- Manual Docker/browser smoke was not run in this step; automated backend/frontend verification passed.

## 2026-05-24 Integrated Workflow Surfaces

- Implemented the remaining planned workflow surfaces in one pass:
  - `ReferenceContextPanel` reads local reference files and appends summaries to new run tasks.
  - `TaskTemplatesPanel` provides structured prompts for research, web QA, data extraction, and form filling.
  - `ArtifactCenter` shows final text, workspace files, and recent screenshot artifacts.
  - `ReplayEvaluationPanel` lets users replay a historical task and locally mark benchmark runs.
- `ChatPanel` now accepts task drafts from templates and replay.
- `App` now appends reference context to created runs while preserving the existing create/start/pause/resume/cancel flow.
- Added `feat-024` to `feature_list.json` with status `done`.
- 2026-05-24: `cd web && npm run build` passed.
- 2026-05-24: `cd web && npm test` passed with 52 tests.
- 2026-05-24: `cd server && . .venv/bin/activate && pytest -v` passed with 68 tests.
- 2026-05-24: `./init.sh` passed.
- 2026-05-24: `python3 -m json.tool feature_list.json` passed.
- Manual Docker/browser smoke was not run; automated backend/frontend verification passed.

## 2026-05-24 Browser E2E Verification

- Ran the local app with the backend in mock mode and opened `http://127.0.0.1:3000/` in a real browser.
- Verified the integrated UI flow:
  - template selection fills the task draft;
  - local reference upload reads a saved HTML reference and appends a `Reference Context` block to newly created runs;
  - workspace upload stores `uploads/f.txt` and surfaces it in the artifact center;
  - replay fills the task input from historical runs without duplicating reference context;
  - benchmark marking persists locally in the replay/evaluation panel;
  - start run completes in mock mode and populates the audit trail, final artifact text, run report, noVNC iframe, and history list.
- Fixed two E2E findings:
  - replaying the same draft text did not update the task input; `ChatPanel` now receives a `taskDraftRevision` so repeated replay/template actions are applied.
  - `Run Report` showed screenshot cache hits under `Cache hits`; it now shows `prompt_cache_hit_tokens`, matching the top run usage summary.
- Verification completed:
  - `cd web && npm test -- ChatPanel.test.tsx`
  - `cd web && npm test -- RunInspector.test.tsx`
  - `cd web && npm run build`
  - Browser reload and manual interaction confirmed `Cache hits` displays `768` for `run_07af8a490b924bae9b8a32c63f5e31f5`.
- Remaining note: browser console shows no React application errors after reload; noVNC still logs its own missing `package.json` 404, which does not block the main product flow.

## 2026-05-24 Advanced Control Suite

- Added design and plan documents:
  - `docs/superpowers/specs/2026-05-24-advanced-control-suite-design.md`
  - `docs/superpowers/plans/2026-05-24-advanced-control-suite.md`
- Implemented the product-layer version of the remaining reference-inspired features:
  - browser/computer/hybrid mode selection;
  - per-run action policy and approval rules;
  - scenario packs for research, form fill, web QA, product monitoring, and content operations;
  - workflow recorder notes;
  - viewport presets for desktop, tablet, and mobile;
  - execution profile injection into newly created run tasks;
  - live context loop, URL/DOM inspector, approval queue, self-healing strategy, and recent context panel;
  - benchmark lab summary in replay/evaluation.
- Fixed browser E2E findings:
  - Start Run failures now refresh run/events/history, select the latest error event, and display the API error in run controls instead of producing an uncaught promise.
  - Run Report now counts `kind: "error"` events.
  - History now shows the latest 12 runs with an explicit count instead of rendering an oversized sidebar list.
- Updated `feat-025` to `done`.
- Verification completed:
  - `cd web && npm run build`
  - `cd web && npm test`
  - Browser E2E on `http://127.0.0.1:3000/` confirmed scenario packs, mode switching, viewport lab, approval rules, workflow notes, Execution Profile injection, replay cleanup, failure-state error display, error event selection, and error count reporting.
- Browser E2E note: noVNC iframe loaded but reported that the VNC server was not connected in this mock-only run; this does not block the advanced control UI flow.

## 2026-05-22 Voice Natural Language Actions

- Added a backend `/api/voice/interpret` endpoint that uses DeepSeek to convert natural speech transcripts into structured task text and a fixed set of UI actions.
- Voice parsing now understands mixed utterances such as `打开浏览器，访问 baidu.com，开始运行` and routes them to the existing `Create Run` and `Start` button flows.
- `approve` and `reject` remain manual-only and are surfaced as a warning instead of an automatic action.
- Updated the Web UI voice flow to call the backend parser before executing actions, with a local command fallback if the parser endpoint is unavailable.
- Updated user docs to explain natural-language voice behavior and the manual confirmation boundary.
- Verification completed:
  - `cd server && . .venv/bin/activate && pytest tests/test_voice_parser.py tests/test_api_routes.py -v`
  - `cd server && . .venv/bin/activate && pytest -v`
  - `cd web && npm test -- api.test.ts ChatPanel.test.tsx`
  - `cd web && npm test`
  - `cd web && npm run build`
  - `./init.sh`

## 2026-05-23 Persistent Voice Mode and Spoken Feedback

- Reviewed the Medkit voice implementation as a reference.
- Borrowed its product shape, not its infrastructure:
  - voice is a persistent mode rather than one-shot push-to-talk;
  - voice has visible listening/thinking/speaking-style state;
  - speech feedback and transcript-style acknowledgement are part of the loop;
  - user language preference is remembered.
- Kept this project on browser Web Speech APIs instead of adding LiveKit, Deepgram, or Cartesia dependencies.
- Updated the Web UI voice flow:
  - `Voice` is now a mode toggle that keeps recognition active and restarts it while enabled;
  - users can choose `zh-CN` or `en-US` for recognition, and the selection is stored in localStorage;
  - browser speech synthesis reads back interpreted task intent, planned UI actions, manual confirmation warnings, and clarification prompts.
- Updated the backend voice parser schema with `needs_clarification` so ambiguous speech can ask a short question without executing actions.
- Preserved the safety boundary: approval and rejection remain manual-only.
- Verification completed:
  - `cd server && . .venv/bin/activate && pytest tests/test_voice_parser.py -v`
  - `cd web && npm test -- ChatPanel.test.tsx useVoiceInput.test.tsx voiceInput.test.ts`
  - `cd server && . .venv/bin/activate && pytest -v`
  - `cd web && npm test`
  - `cd web && npm run build`
  - `python3 -m json.tool feature_list.json`
  - `./init.sh`

## 2026-05-23 Current Task Visibility and Run History

- Identified a general UX gap: `ChatPanel` clears the task input after creating a run, leaving no stable place to see what the current run is doing.
- Added current task visibility to the run controls panel so the task text remains visible while the run executes.
- Added run history:
  - backend `GET /api/runs` returns run ID, task, status, created/updated time, and final result;
  - run summaries are persisted to the existing SQLite database path under `data/app.db`;
  - frontend sidebar renders a selectable history list and can switch back to a previous run.
- Updated English and Chinese README files with the current task/history behavior.
- Verification completed:
  - `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py::test_list_runs_returns_history_with_task_time_and_result -v`
  - `cd web && npm test -- RunControls.test.tsx RunHistoryPanel.test.tsx api.test.ts`
  - `cd server && . .venv/bin/activate && pytest -v`
  - `cd web && npm test`
  - `cd web && npm run build`
  - `python3 -m json.tool feature_list.json`
  - `./init.sh`

## 2026-05-25 Run Settings Disclosure and Sandbox CJK Fonts

- Investigated two reported UX/runtime bugs:
  - `Run Settings` relied on native `<details>/<summary>`, which was not working reliably for the user and hid Viewport Lab.
  - Chinese text inside the sandbox Chromium rendered as missing glyph boxes because the Debian runtime image did not install CJK fonts.
- Replaced the setup rail disclosures with explicit React-controlled accordion buttons for Task Assist and Run Settings.
- Updated disclosure styling so expanded panels retain the simplified workbench layout while exposing Advanced Control Suite and Workspace.
- Added `fontconfig` and `fonts-noto-cjk` to the sandbox runtime image and refresh the font cache during image build.
- Verification completed:
  - `cd web && npm run build`
  - `docker compose config`
  - Browser E2E on `http://127.0.0.1:3000/` confirmed clicking `运行设置` expands the panel and reveals `视口实验室`.
- Runtime note: final visual verification for Chinese rendering requires the CI-built runtime image to be pulled with `./start.sh` after Actions completes.

## 2026-05-25 Left Rail Accordion Overlap Follow-up

- Confirmed from the latest desktop screenshot that sandbox Chinese rendering is fixed and the remaining issue is left-rail expanded menu collision when `模板与参考资料` and `运行设置` are both open.
- Changed the setup disclosures to an exclusive accordion: opening one section closes the other.
- Added a bounded internal scroll area for disclosure content so a large panel cannot visually collide with the next setup section.
- Verification completed:
  - `cd web && npm run build`
  - Browser E2E on `http://127.0.0.1:3000/` confirmed `模板与参考资料` expands first, clicking `运行设置` collapses it, and `运行设置` expands without overlapping the previous menu.


## 2026-05-25 Viewport Lab Runtime Resize

- Reframed Viewport Lab as a real runtime viewport control rather than a passive profile field.
- Added concise design and implementation plan docs:
  - `docs/superpowers/specs/2026-05-25-viewport-runtime-resize-design.md`
  - `docs/superpowers/plans/2026-05-25-viewport-runtime-resize.md`
- Added frontend `setSandboxViewport` API client and wired viewport changes from `ControlProfile` to `/api/sandbox/viewport`.
- Added backend `POST /api/sandbox/viewport` with validated dimensions and runtime forwarding.
- Added runtime `resize_viewport` support using best-effort Xvfb framebuffer resize plus Chromium window resize through `xdotool`.
- Increased runtime virtual display capacity to `1440x1112` so all built-in presets can fit.
- Updated the center sandbox stage with a viewport-aware frame and badge so Desktop, Tablet, and Mobile selections are visibly different.
- Verification completed:
  - `cd web && npm test -- api.test.ts`
  - `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py::test_set_sandbox_viewport_forwards_to_runtime tests/test_api_routes.py::test_set_sandbox_viewport_rejects_invalid_dimensions tests/test_runtime_daemon_paths.py::test_resize_viewport_updates_framebuffer_and_browser_window -v`
  - `cd server && . .venv/bin/activate && pytest tests/test_api_routes.py tests/test_runtime_daemon_paths.py -v`
  - `cd web && npm run build`
  - `docker compose config`
  - Browser E2E on `http://127.0.0.1:3001/` confirmed Mobile and Tablet update the center sandbox frame, badge text, `data-viewport`, and active viewport button state.
- Runtime E2E note: local ports `3000` and `8000` were occupied by old Docker services, so browser validation used Vite on `3001`; true runtime endpoint verification should be repeated after Actions builds and `./start.sh` pulls the new images.
