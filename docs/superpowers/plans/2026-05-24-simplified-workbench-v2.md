# Simplified Workbench v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce default UI complexity and fix right-rail panel overlap by moving advanced controls and developer surfaces behind explicit tabs or disclosure panels.

**Architecture:** Keep the sandbox-first three-column layout. The left rail becomes task-first with collapsed templates/references/settings. The right rail becomes a single run monitor with tabs for overview, steps, files, and debug so only one dense surface is visible at a time.

**Tech Stack:** React, TypeScript, existing i18n helper, CSS.

---

### Task 1: Left Rail Simplification

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/i18n.tsx`

- [x] Wrap templates and references in a collapsed setup disclosure.
- [x] Wrap advanced controls and workspace upload in a collapsed settings disclosure.
- [x] Add bilingual labels for the disclosures.

### Task 2: Right Rail Tabs

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/i18n.tsx`

- [x] Add an `inspectorTab` state with `overview`, `steps`, `files`, and `debug`.
- [x] Keep run controls always visible at the top of the right rail.
- [x] Render artifacts in Overview and Files.
- [x] Render timeline/details/report only in Steps.
- [x] Render history/replay and agent operations only in Debug.

### Task 3: Harness State and Verification

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`

- [x] Add `feat-029` for Simplified Workbench v2.
- [x] Record build and browser verification evidence.
