# Viewport Runtime Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Viewport Lab switch both the visible sandbox preview and the runtime browser viewport.

**Architecture:** Add a small frontend API call for viewport changes, a validated FastAPI endpoint that proxies to the runtime action daemon, and a runtime `resize_viewport` computer action using xdotool plus Chromium DevTools emulation. Keep viewport presets centralized in the existing advanced controls model.

**Tech Stack:** React, TypeScript, FastAPI, Python runtime daemon, xdotool, Chromium DevTools HTTP endpoint.

---

### Task 1: Add tests for viewport API and runtime resize

**Files:**
- Modify: `web/src/api.test.ts`
- Modify: `server/tests/test_api_routes.py`
- Modify: `server/tests/test_runtime_daemon_paths.py`

- [ ] Add failing tests for frontend `setSandboxViewport`, backend `/api/sandbox/viewport`, and runtime `resize_viewport`.

### Task 2: Implement viewport API chain

**Files:**
- Modify: `web/src/api.ts`
- Modify: `server/src/deepseek_computer_use/api/routes.py`
- Modify: `runtime/daemon.py`

- [ ] Add `setSandboxViewport` client helper.
- [ ] Add backend validation and runtime forwarding.
- [ ] Add runtime `resize_viewport` handling.

### Task 3: Implement visible sandbox preview

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/AdvancedControlSuite.tsx`
- Modify: `web/src/components/ComputerPanel.tsx`
- Modify: `web/src/styles.css`
- Modify: `web/src/i18n.tsx`

- [ ] Wire viewport changes through the app.
- [ ] Add viewport label and frame sizing classes.
- [ ] Keep selection in the execution profile.

### Task 4: Verify and document

**Files:**
- Modify: `feature_list.json`
- Modify: `progress.md`

- [ ] Run targeted tests, frontend build, init, and browser E2E.
- [ ] Record verification evidence and acceptance steps.
