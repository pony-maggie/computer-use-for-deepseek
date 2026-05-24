# Sandbox-First Workbench Design

## Goal

Keep the sandbox computer visible as the primary surface of Computer Use for DeepSeek. Long task text, approval cards, timeline events, artifacts, and advanced controls must never push the sandbox below the first viewport.

## Problem

The current UI stacks `RunControls`, the sandbox computer, and the inspector vertically inside the main workspace. When a run has a long task, an execution profile, or a pending approval, the top panels grow and force the sandbox down the page. This breaks the core computer-use interaction because the user cannot supervise the remote computer without scrolling.

## Design

Use a fixed three-column workbench on desktop:

- Left setup rail: language, task composer, templates, advanced control, references, and workspace files.
- Center sandbox stage: the noVNC computer, always visible and sized as the main surface.
- Right inspector rail: run controls, approvals, history, replay/evaluation, timeline, operations, and artifacts.

Each column owns its own scrolling. The page itself does not scroll. Long task text is clipped inside the run control panel and full details remain available inside the inspector rail.

## Interaction Rules

- The center sandbox stage is the visual anchor and gets the largest flexible column.
- Approval UI lives in the right inspector rail, not above the sandbox.
- Run task details are summarized by default and constrained to a small scrollable region.
- The event timeline, JSON step detail, operations panel, artifacts, history, and replay controls scroll within the right rail.
- The left rail remains task setup, not live supervision.

## Responsive Behavior

Desktop and large laptop layouts use three columns. Narrow screens collapse into a single-column flow with the sandbox appearing before the inspector so it remains easy to reach.

## Acceptance Criteria

- At 1440x900, the sandbox computer is visible in the first viewport without scrolling.
- Pending approval state does not move or resize the sandbox out of view.
- Long task text does not expand the main layout.
- Run inspector and artifacts remain accessible in the right rail.
- Browser E2E verifies the running, approval, and canceled states after layout changes.
