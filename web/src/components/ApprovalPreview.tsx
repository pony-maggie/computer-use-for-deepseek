type Props = {
  summary: string;
  payload: unknown;
  canApprove: boolean;
  canReject: boolean;
  approving: boolean;
  rejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalPreview({
  summary,
  payload,
  canApprove,
  canReject,
  approving,
  rejecting,
  onApprove,
  onReject,
}: Props) {
  return (
    <div className="approval-preview">
      <span className="eyebrow">Approval Required</span>
      <strong>{summary}</strong>
      <p>{describeApprovalPayload(payload)}</p>
      <details className="confirmation-details">
        <summary>Raw action details</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>
      <div className="confirmation-actions">
        <button disabled={!canApprove} onClick={onApprove}>
          {approving ? "Approving..." : "Approve"}
        </button>
        <button disabled={!canReject} onClick={onReject}>
          {rejecting ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}

export function describeApprovalPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Review the action before continuing.";
  const value = payload as Record<string, unknown>;
  if (typeof value.command === "string") return `Command: ${value.command}`;
  if (typeof value.action === "string") return `Computer action: ${value.action}`;
  if (typeof value.path === "string") return `File action on ${value.path}`;
  if (value.computer && typeof value.computer === "object") {
    const computer = value.computer as Record<string, unknown>;
    if (typeof computer.action === "string") return `Computer action: ${computer.action}`;
  }
  if (value.bash && typeof value.bash === "object") {
    const bash = value.bash as Record<string, unknown>;
    if (typeof bash.command === "string") return `Command: ${bash.command}`;
  }
  if (value.text_editor && typeof value.text_editor === "object") {
    const textEditor = value.text_editor as Record<string, unknown>;
    if (typeof textEditor.path === "string") return `File action on ${textEditor.path}`;
  }
  return "Review the action before continuing.";
}
