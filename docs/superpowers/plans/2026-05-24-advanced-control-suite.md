# Advanced Control Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser/computer mode, action policy, live context loop, DOM inspector, recorder, scenario packs, approval queue, recovery panel, benchmark lab, and viewport lab as one coherent product layer.

**Architecture:** Keep this pass frontend-only except harness documentation. Store an execution profile in `App`, render controls in the sidebar, inject the profile into new run tasks, and display runtime context in the workbench.

**Tech Stack:** React, TypeScript, existing CSS, existing FastAPI run APIs.

---

### Task 1: Shared control profile model

**Files:**
- Create: `web/src/components/advancedControls.ts`

- [x] Define execution mode, action policy, viewport presets, scenario packs, recovery strategies, and `formatExecutionProfile`.

### Task 2: Sidebar control suite

**Files:**
- Create: `web/src/components/AdvancedControlSuite.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

- [x] Add mode switching, action policy controls, scenario packs, recorder notes, and viewport presets.
- [x] Wire scenario packs into task draft fill.
- [x] Inject profile text into newly created runs.

### Task 3: Workbench operations panel

**Files:**
- Create: `web/src/components/AgentOperationsPanel.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

- [x] Add live loop, URL/DOM context, approval queue, recovery strategy, and recent event summaries.

### Task 4: Benchmark lab upgrade

**Files:**
- Modify: `web/src/components/ReplayEvaluationPanel.tsx`
- Modify: `web/src/styles.css`

- [x] Extend replay/evaluation with benchmark count, active run summary, and local benchmark list.

### Task 5: Harness state

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`

- [x] Add `feat-025` and record implementation notes.

## Verification plan

Run when verification is requested:

```bash
cd web && npm run build
cd web && npm test
python3 -m json.tool feature_list.json >/dev/null
./init.sh
```
