# Advanced Control Suite Design

## Goal

Add the remaining product-level feature ideas from the Gemini Computer Use, browser-use, and Qoder references as one cohesive control and observability layer for Computer Use for DeepSeek.

## Reference synthesis

The references point to ten product needs:

- Explicit browser-use vs computer-use routing.
- Per-run action restrictions and approval requirements.
- A visible screenshot/context/model/action/environment loop.
- URL and DOM-oriented inspection for web tasks.
- Recording and replaying workflows.
- Scenario-specific task packs.
- A first-class approval queue.
- Recovery and self-healing strategy visibility.
- Benchmark and evaluation tracking.
- Mobile and responsive viewport testing.

## Design

The feature ships as an Advanced Control Suite in the sidebar and an Agent Operations panel in the workbench.

The first version is product-layer only. It makes the controls visible, stores the current run profile in React state, and injects that profile into newly created run tasks as an `Execution Profile` block. This gives the model clear instructions without changing the lower-level runtime boundary. Hard backend enforcement can be added later after the UI contract stabilizes.

## Components

- `advancedControls.ts`: shared types, defaults, scenario packs, viewport presets, recovery strategies, and execution-profile formatting.
- `AdvancedControlSuite.tsx`: mode switcher, action policy controls, scenario packs, task recorder notes, and viewport presets.
- `AgentOperationsPanel.tsx`: live loop explanation, URL/DOM inspection placeholders, approval queue, recovery strategy, and recent event context.
- `ReplayEvaluationPanel.tsx`: upgrades the existing replay panel into a small benchmark lab.

## Data flow

1. User configures mode, policy, scenario, recorder notes, and viewport in `AdvancedControlSuite`.
2. `App` stores the profile and passes it to the suite and operations panel.
3. When a run is created, `App` appends an `Execution Profile` block and then the existing `Reference Context` block.
4. Replay strips both `Execution Profile` and `Reference Context` blocks so the task can be edited cleanly.
5. Agent Operations reads current run/events/profile and explains what the agent sees, which approvals are pending, and which recovery strategies are active.

## Non-goals for this pass

- No new backend database schema.
- No hard runtime enforcement of action policy.
- No mobile container orchestration changes.
- No browser DOM snapshot API changes.

These are intentionally deferred so the UI and workflow can be reviewed before changing execution semantics.
