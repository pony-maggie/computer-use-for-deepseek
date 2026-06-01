# Durable Run Transcript Design

## Goal

Persist the model-facing run transcript so `Computer Use for DeepSeek` can recover run context after process restarts, especially while a run is waiting for user confirmation.

## Scope

This feature stores the backend agent context needed to continue a run. It does not add a user-facing transcript viewer, session sharing, or exported raw logs.

## Data Model

Run summaries remain in the existing `runs` table. The table now also stores the model name, step count, usage counters, estimated cost, and pending confirmation JSON. Full agent messages are stored in a separate ordered `run_messages` table:

- `run_id`: owning run.
- `sequence`: message order.
- `role`: copied from the message payload for inspection and filtering.
- `payload_json`: the exact model-facing message object.

The API response keeps `agent_messages` excluded, so this remains backend state rather than a normal user-visible surface.

## Flow

`AgentCore` returns the full message context for terminal, budget-failed, max-step, and confirmation-waiting results. `_apply_run_result` persists the run state and replaces the stored message snapshot atomically at the feature level. When an in-memory run is missing, `_load_persisted_run` rebuilds `RunState` from SQLite, including usage, pending confirmation, and the hidden message context.

## Safety And Privacy

The transcript is local-only SQLite state under the app data path. It may contain model-facing task context and tool results, so it is not exposed through run list/detail API responses and is not added to memory capture directly.

## Verification

- Add a red-green `AgentCore` test proving completed runs return agent messages.
- Add a red-green API persistence test proving a waiting run can restore pending confirmation, usage, and agent messages after in-memory state is removed.
- Run backend regression tests, compose config, JSON validation, and `./init.sh`.
