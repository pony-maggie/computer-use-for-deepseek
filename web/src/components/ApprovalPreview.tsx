import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  return (
    <div className="approval-preview">
      <span className="eyebrow">{t("approval.header")}</span>
      <strong>{summary}</strong>
      <p>{describeApprovalPayload(payload, t)}</p>
      <details className="confirmation-details">
        <summary>{t("approval.raw")}</summary>
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </details>
      <div className="confirmation-actions">
        <button disabled={!canApprove} onClick={onApprove}>
          {approving ? t("approval.approving") : t("approval.approve")}
        </button>
        <button disabled={!canReject} onClick={onReject}>
          {rejecting ? t("approval.rejecting") : t("approval.reject")}
        </button>
      </div>
    </div>
  );
}

export function describeApprovalPayload(
  payload: unknown,
  t: ReturnType<typeof useI18n>["t"] = defaultT,
): string {
  if (!payload || typeof payload !== "object") return t("approval.review");
  const value = payload as Record<string, unknown>;
  if (typeof value.command === "string") return `${t("approval.command")}: ${value.command}`;
  if (typeof value.action === "string") return `${t("approval.computerAction")}: ${value.action}`;
  if (typeof value.path === "string") return `${t("approval.fileAction")} ${value.path}`;
  if (value.computer && typeof value.computer === "object") {
    const computer = value.computer as Record<string, unknown>;
    if (typeof computer.action === "string") return `${t("approval.computerAction")}: ${computer.action}`;
  }
  if (value.bash && typeof value.bash === "object") {
    const bash = value.bash as Record<string, unknown>;
    if (typeof bash.command === "string") return `${t("approval.command")}: ${bash.command}`;
  }
  if (value.text_editor && typeof value.text_editor === "object") {
    const textEditor = value.text_editor as Record<string, unknown>;
    if (typeof textEditor.path === "string") return `${t("approval.fileAction")} ${textEditor.path}`;
  }
  return t("approval.review");
}

const defaultApprovalText = {
  "approval.review": "Review the action before continuing.",
  "approval.command": "Command",
  "approval.computerAction": "Computer action",
  "approval.fileAction": "File action on",
} as const;

const defaultT: ReturnType<typeof useI18n>["t"] = (key) =>
  key in defaultApprovalText ? defaultApprovalText[key as keyof typeof defaultApprovalText] : key;
