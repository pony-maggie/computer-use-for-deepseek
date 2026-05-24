type WorkspaceUploadStateInput = {
  runId: string | null;
  stagedFileCount: number;
  uploading: boolean;
  uploadingMessage?: string;
  readySingularMessage?: string;
  readyPluralMessage?: string;
};

type WorkspaceUploadState = {
  inputDisabled: boolean;
  message: string | null;
};

export function getWorkspaceUploadState({
  runId,
  stagedFileCount,
  uploading,
  uploadingMessage = "Uploading files...",
  readySingularMessage = "file ready for the next run.",
  readyPluralMessage = "files ready for the next run.",
}: WorkspaceUploadStateInput): WorkspaceUploadState {
  if (uploading) {
    return { inputDisabled: true, message: uploadingMessage };
  }
  if (stagedFileCount > 0 && !runId) {
    return {
      inputDisabled: false,
      message: `${stagedFileCount} ${
        stagedFileCount === 1 ? readySingularMessage : readyPluralMessage
      }`,
    };
  }
  return { inputDisabled: false, message: null };
}
