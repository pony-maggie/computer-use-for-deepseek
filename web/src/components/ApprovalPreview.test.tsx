import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApprovalPreview, describeApprovalPayload } from "./ApprovalPreview";

describe("ApprovalPreview", () => {
  it("renders summary and raw action details", () => {
    render(
      <ApprovalPreview
        summary="Click submit"
        payload={{ action: "left_click", coordinate: [20, 30] }}
        canApprove={true}
        canReject={true}
        approving={false}
        rejecting={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    expect(screen.getByText("Approval Required")).toBeTruthy();
    expect(screen.getByText("Click submit")).toBeTruthy();
    expect(screen.getByText("Computer action: left_click")).toBeTruthy();
    expect(screen.getAllByText(/left_click/).length).toBeGreaterThan(0);
  });

  it("describes shell and text editor payloads", () => {
    expect(describeApprovalPayload({ command: "ls" })).toBe("Command: ls");
    expect(describeApprovalPayload({ path: "notes.txt" })).toBe("File action on notes.txt");
    expect(describeApprovalPayload({ bash: { command: "pwd" } })).toBe("Command: pwd");
  });
});
