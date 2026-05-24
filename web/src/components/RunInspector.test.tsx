import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Run, RunEvent } from "../types";
import { RunInspector } from "./RunInspector";

const run: Run = {
  run_id: "run_1",
  task: "open example.com",
  status: "completed",
  final_text: "done",
  steps: 2,
  max_steps: 20,
  model: "deepseek",
  token_budget: 1000,
  cost_budget_usd: 1,
  prompt_tokens: 10,
  completion_tokens: 5,
  total_tokens: 15,
  prompt_cache_hit_tokens: 7,
  prompt_cache_miss_tokens: 10,
  estimated_cost_usd: 0.001,
};

const structuredClickEvent: RunEvent = {
  id: "evt_1",
  kind: "tool",
  status: "completed",
  message: "clicked",
  step: 1,
  tool_name: "computer",
  action_name: "left_click",
  action_payload: { coordinate: [10, 20] },
  display: { width: 1280, height: 800, scale: 1 },
};

afterEach(() => {
  cleanup();
});

describe("RunInspector", () => {
  it("renders old and new event shapes and selects steps", () => {
    const onSelectEvent = vi.fn();
    render(
      <RunInspector
        run={run}
        events={[{ kind: "created", message: "Run created" }, structuredClickEvent]}
        selectedEventId={null}
        onSelectEvent={onSelectEvent}
      />,
    );

    expect(screen.getByText("Audit Trail")).toBeTruthy();
    expect(screen.getByText("computer: left_click")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "computer: left_click" }));
    expect(onSelectEvent).toHaveBeenCalledWith(structuredClickEvent);
  });

  it("renders details and report metrics", () => {
    render(
      <RunInspector
        run={run}
        events={[structuredClickEvent, { kind: "error", message: "missing key" }]}
        selectedEventId="evt_1"
        onSelectEvent={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Step Details").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/left_click/).length).toBeGreaterThan(0);
    expect(screen.getByText("Run Report")).toBeTruthy();
    expect(screen.getByText("$0.0010")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
  });
});
