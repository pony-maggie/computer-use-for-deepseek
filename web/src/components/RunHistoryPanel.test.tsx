import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunHistoryPanel } from "./RunHistoryPanel";
import type { RunHistoryItem } from "../types";

const history: RunHistoryItem[] = [
  {
    run_id: "run_new",
    task: "检查 example.com 标题",
    status: "completed",
    final_text: "Title is Example Domain",
    created_at: "2026-05-23T10:00:00+00:00",
    updated_at: "2026-05-23T10:03:00+00:00",
  },
];

describe("RunHistoryPanel", () => {
  it("shows run history with id, task, time, status, and result", () => {
    const onSelectRun = vi.fn();

    render(
      <RunHistoryPanel
        history={history}
        activeRunId={null}
        onSelectRun={onSelectRun}
      />,
    );

    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("run_new")).toBeTruthy();
    expect(screen.getByText("检查 example.com 标题")).toBeTruthy();
    expect(screen.getByText("completed")).toBeTruthy();
    expect(screen.getByText("Title is Example Domain")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Open run_new/ }));

    expect(onSelectRun).toHaveBeenCalledWith("run_new");
  });
});
