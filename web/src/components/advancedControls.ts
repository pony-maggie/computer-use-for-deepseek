export type ExecutionMode = "browser" | "computer" | "hybrid";

export type ActionPolicy = {
  allowClick: boolean;
  allowType: boolean;
  allowScroll: boolean;
  allowDownload: boolean;
  allowShell: boolean;
  allowFileAccess: boolean;
  requireApprovalForSubmits: boolean;
  requireApprovalForExternalNavigation: boolean;
  requireApprovalForDestructiveActions: boolean;
};

export type ViewportPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export type ScenarioPack = {
  id: string;
  label: string;
  description: string;
  task: string;
  recommendedMode: ExecutionMode;
};

export type ControlProfile = {
  mode: ExecutionMode;
  actionPolicy: ActionPolicy;
  viewportId: string;
  workflowNotes: string[];
};

export const viewportPresets: ViewportPreset[] = [
  { id: "desktop", label: "Desktop 1440x900", width: 1440, height: 900 },
  { id: "tablet", label: "Tablet 834x1112", width: 834, height: 1112 },
  { id: "mobile", label: "Mobile 390x844", width: 390, height: 844 },
];

export const scenarioPacks: ScenarioPack[] = [
  {
    id: "research-report",
    label: "Research Report",
    description: "Compare sources, cite evidence, and produce a concise report.",
    recommendedMode: "browser",
    task:
      "Research the target topic across multiple credible web sources. Capture evidence, compare conflicting claims, and produce a concise report with source links, assumptions, and follow-up questions.",
  },
  {
    id: "form-fill",
    label: "Form Fill",
    description: "Use references to fill forms, stopping before submission.",
    recommendedMode: "hybrid",
    task:
      "Use the provided reference files to fill the target web form. Validate each field before moving on. Stop for confirmation before submitting, uploading, purchasing, or changing account settings.",
  },
  {
    id: "web-qa",
    label: "Web QA",
    description: "Exercise a web flow and return prioritized bugs.",
    recommendedMode: "hybrid",
    task:
      "Open the target web app. Check layout, navigation, forms, buttons, console-visible errors, and mobile-sized behavior. Return a prioritized QA report with reproduction steps and screenshots when useful.",
  },
  {
    id: "product-monitor",
    label: "Product Monitor",
    description: "Collect product data, prices, reviews, and availability.",
    recommendedMode: "browser",
    task:
      "Visit the target product pages. Extract name, price, rating, review count, stock status, shipping notes, and source URL. Save structured results to the workspace and summarize buying tradeoffs.",
  },
  {
    id: "content-ops",
    label: "Content Ops",
    description: "Draft and preview content, requiring approval before publish.",
    recommendedMode: "computer",
    task:
      "Draft content for the target platform, preview it in the UI, and stop for human approval before posting, sending, publishing, deleting, or changing account settings.",
  },
];

export const recoveryStrategies = [
  "Wait for the page or desktop state to settle, then capture a fresh screenshot.",
  "Prefer DOM or URL evidence for browser tasks before falling back to visual clicks.",
  "Retry failed clicks with a nearby coordinate only after checking the target label.",
  "Stop and ask for confirmation before destructive, paid, or irreversible actions.",
  "Offer manual takeover when the page is blocked by login, captcha, or policy gates.",
];

export const defaultControlProfile: ControlProfile = {
  mode: "hybrid",
  viewportId: "desktop",
  workflowNotes: [],
  actionPolicy: {
    allowClick: true,
    allowType: true,
    allowScroll: true,
    allowDownload: true,
    allowShell: false,
    allowFileAccess: true,
    requireApprovalForSubmits: true,
    requireApprovalForExternalNavigation: false,
    requireApprovalForDestructiveActions: true,
  },
};

export function getViewportPreset(viewportId: string): ViewportPreset {
  return viewportPresets.find((preset) => preset.id === viewportId) ?? viewportPresets[0];
}

export function formatExecutionProfile(profile: ControlProfile): string {
  const viewport = getViewportPreset(profile.viewportId);
  const allowedActions = [
    profile.actionPolicy.allowClick ? "click" : null,
    profile.actionPolicy.allowType ? "type" : null,
    profile.actionPolicy.allowScroll ? "scroll" : null,
    profile.actionPolicy.allowDownload ? "download" : null,
    profile.actionPolicy.allowShell ? "shell" : null,
    profile.actionPolicy.allowFileAccess ? "file access" : null,
  ].filter(Boolean);
  const approvalRules = [
    profile.actionPolicy.requireApprovalForSubmits ? "submits" : null,
    profile.actionPolicy.requireApprovalForExternalNavigation ? "external navigation" : null,
    profile.actionPolicy.requireApprovalForDestructiveActions ? "destructive actions" : null,
  ].filter(Boolean);
  const workflowNotes = profile.workflowNotes.length
    ? profile.workflowNotes.map((note, index) => `${index + 1}. ${note}`).join("\n")
    : "None recorded.";

  return `\n\nExecution Profile\nMode: ${profile.mode}\nViewport: ${viewport.label}\nAllowed actions: ${allowedActions.join(", ") || "none"}\nApproval required for: ${approvalRules.join(", ") || "none"}\nRecovery strategy: wait, inspect DOM/URL when available, retry cautiously, stop on blocked/high-risk states.\nWorkflow recorder notes:\n${workflowNotes}`;
}

export function stripExecutionBlocks(task: string): string {
  return task.split("\n\nExecution Profile\n")[0].split("\n\nReference Context\n")[0] ?? task;
}
