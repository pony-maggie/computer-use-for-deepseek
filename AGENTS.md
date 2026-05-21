# AGENTS.md

Operating guide for agents working on Computer Use for DeepSeek.

This repository follows a lightweight harness inspired by Learn Harness Engineering:
https://github.com/walkinglabs/learn-harness-engineering

## Startup Workflow

Before changing files:

1. Read this file.
2. Read `progress.md` for current project state and recent decisions.
3. Read `feature_list.json` and pick exactly one feature to work on.
4. Read the relevant design or plan under `docs/superpowers/`.
5. Run `./init.sh` and inspect the output.
6. Check the current worktree state if this directory is a git repo.

## Working Rules

- Work on one feature at a time.
- Keep the user-facing product name as `Computer Use for DeepSeek`.
- Treat Docker as an implementation detail for normal users. User docs should prefer `./start.sh` and `./stop.sh`.
- Keep README files user-focused. Put implementation detail in plans, specs, or developer docs.
- Do not mount a user's full home directory by default.
- Preserve the local web app product direction: upload files, run tasks, watch the sandbox computer, download results.
- Do not claim work is complete without fresh verification evidence.
- If verification cannot run because code does not exist yet, state that explicitly.

## Required Harness Files

- `AGENTS.md`: agent operating manual.
- `feature_list.json`: feature scope and status tracker.
- `progress.md`: session continuity log.
- `init.sh`: standard repository initialization and sanity check.

## Verification

Use the narrowest relevant command for the work:

- Documentation-only changes: `./init.sh` and a targeted `rg`/file read check.
- Backend changes after scaffold exists: `cd server && pytest -v`.
- Frontend changes after scaffold exists: `cd web && npm run build`.
- Runtime changes after scaffold exists: `docker compose config` and the runtime smoke command from the plan.

If a command fails, do not work around it silently. Record the failure and either fix it or explain the blocker.

## Definition of Done

A feature is done only when:

- The requested files are updated.
- The change is consistent with the approved design and plan.
- Verification has been run or a concrete blocker is recorded.
- `feature_list.json` reflects the updated feature status.
- `progress.md` records what changed, what was verified, and what remains.

## End of Session

Before ending a development session:

1. Update `progress.md`.
2. Update `feature_list.json` if feature status changed.
3. Record verification evidence.
4. Record blockers or follow-up work.
5. Leave the repo restartable for the next agent session.
