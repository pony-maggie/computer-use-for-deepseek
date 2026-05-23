import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunControls } from "./RunControls";
import type { Run } from "../types";

const baseRun: Run = {
  run_id: "run_123",
  task: "打开浏览器，访问 baidu.com",
  status: "running",
  final_text: null,
  steps: 1,
  max_steps: 30,
  model: "deepseek-v4-pro",
  token_budget: 2000000,
  cost_budget_usd: 0,
  prompt_tokens: 10,
  completion_tokens: 5,
  total_tokens: 15,
  prompt_cache_hit_tokens: 0,
  prompt_cache_miss_tokens: 10,
  estimated_cost_usd: 0,
  created_at: "2026-05-23T10:00:00+00:00",
  updated_at: "2026-05-23T10:01:00+00:00",
};

describe("RunControls", () => {
  it("shows the current run task while the input box can be cleared", () => {
    render(
      <RunControls
        runId="run_123"
        status="running"
        run={baseRun}
        pendingAction={null}
        onStart={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onCancel={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText("Current Task")).toBeTruthy();
    expect(screen.getByText("打开浏览器，访问 baidu.com")).toBeTruthy();
  });
});
