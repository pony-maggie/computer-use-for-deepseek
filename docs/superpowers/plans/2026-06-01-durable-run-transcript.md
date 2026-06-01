# Durable Run Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and restore backend agent transcripts for runs, including waiting-for-confirmation state.

**Architecture:** Extend the existing SQLite persistence layer with run execution fields and an ordered `run_messages` table. Keep transcript data hidden from API serialization while restoring it into `RunState` for backend continuation.

**Tech Stack:** Python, FastAPI, SQLAlchemy, SQLite, pytest.

---

### Task 1: Red Tests

**Files:**
- Modify: `server/tests/test_agent_core.py`
- Modify: `server/tests/test_api_routes.py`

- [x] Add `test_agent_loop_runs_tool_and_returns_final_text` assertions that completed results include system, user, assistant, tool, assistant message roles.
- [x] Add `test_get_run_restores_persisted_agent_messages_and_pending_confirmation` to persist a waiting run, remove in-memory state, and restore pending confirmation, usage counters, and agent messages from SQLite.
- [x] Run both tests and verify they fail for missing `agent_messages` and incomplete persisted restore behavior.

### Task 2: Persistence Schema

**Files:**
- Modify: `server/src/deepseek_computer_use/persistence/schema.py`
- Modify: `server/src/deepseek_computer_use/persistence/repositories.py`
- Modify: `server/src/deepseek_computer_use/api/routes.py`

- [x] Add run execution fields to `RunRecord`: `model`, `steps`, token counters, estimated cost, and `pending_confirmation_json`.
- [x] Add `RunMessageRecord` with `run_id`, `sequence`, `role`, and `payload_json`.
- [x] Add repository methods to replace and list ordered agent messages.
- [x] Extend the lightweight startup migration to add new `runs` columns for existing SQLite databases.

### Task 3: Agent And API Wiring

**Files:**
- Modify: `server/src/deepseek_computer_use/agent/core.py`
- Modify: `server/src/deepseek_computer_use/api/routes.py`

- [x] Return `agent_messages` from completed, failed-budget, max-step, and waiting-confirmation run results.
- [x] Persist run execution fields and pending confirmation JSON in `_persist_run`.
- [x] Replace stored message snapshots in `_apply_run_result`.
- [x] Restore pending confirmation and hidden agent messages in `_load_persisted_run`.
- [x] Clear persisted messages when a waiting confirmation is rejected.

### Task 4: Verification And Records

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`

- [x] Run targeted backend tests for `test_agent_core.py`, `test_api_routes.py`, and `test_memory_service.py`.
- [x] Run full backend pytest.
- [x] Run project sanity checks: JSON validation, compose config, and `./init.sh`.
- [x] Update feature and progress records with verification evidence.
