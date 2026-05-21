import { describe, expect, it } from "vitest";
import { getWorkspaceUploadState } from "./workspaceUploadState";

describe("getWorkspaceUploadState", () => {
  it("keeps the file picker enabled before a run exists", () => {
    expect(
      getWorkspaceUploadState({ runId: null, stagedFileCount: 0, uploading: false }).inputDisabled,
    ).toBe(false);
  });

  it("shows staged files waiting for the next run", () => {
    expect(
      getWorkspaceUploadState({ runId: null, stagedFileCount: 2, uploading: false }).message,
    ).toBe("2 files ready for the next run.");
  });

  it("disables the file picker only while uploading", () => {
    expect(
      getWorkspaceUploadState({ runId: "run_1", stagedFileCount: 1, uploading: true }).inputDisabled,
    ).toBe(true);
  });
});
