type WorkspaceUploadStateInput = {
  runId: string | null;
  stagedFileCount: number;
  uploading: boolean;
};

type WorkspaceUploadState = {
  inputDisabled: boolean;
  message: string | null;
};

export function getWorkspaceUploadState({
  runId,
  stagedFileCount,
  uploading,
}: WorkspaceUploadStateInput): WorkspaceUploadState {
  if (uploading) {
    return { inputDisabled: true, message: "Uploading files..." };
  }
  if (stagedFileCount > 0 && !runId) {
    return {
      inputDisabled: false,
      message: `${stagedFileCount} ${stagedFileCount === 1 ? "file" : "files"} ready for the next run.`,
    };
  }
  return { inputDisabled: false, message: null };
}
