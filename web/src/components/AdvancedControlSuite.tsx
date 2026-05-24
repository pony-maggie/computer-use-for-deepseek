import { useI18n } from "../i18n";
import type { TranslationKey } from "../i18n";
import type { ControlProfile, ScenarioPack } from "./advancedControls";
import { scenarioPacks, viewportPresets } from "./advancedControls";

type Props = {
  profile: ControlProfile;
  onProfileChange: (profile: ControlProfile) => void;
  onApplyScenario: (scenario: ScenarioPack) => void;
};

const actionOptions = [
  ["allowClick", "Click"],
  ["allowType", "Type"],
  ["allowScroll", "Scroll"],
  ["allowDownload", "Download"],
  ["allowFileAccess", "File access"],
  ["allowShell", "Shell"],
] as const;

const approvalOptions = [
  ["requireApprovalForSubmits", "Submits"],
  ["requireApprovalForExternalNavigation", "External nav"],
  ["requireApprovalForDestructiveActions", "Destructive"],
] as const;

export function AdvancedControlSuite({ profile, onProfileChange, onApplyScenario }: Props) {
  const { t, locale } = useI18n();
  const modeLabels: Record<ControlProfile["mode"], TranslationKey> = {
    browser: "advanced.browser",
    computer: "advanced.computer",
    hybrid: "advanced.hybrid",
  };

  function update(next: Partial<ControlProfile>) {
    onProfileChange({ ...profile, ...next });
  }

  function updatePolicy(key: keyof ControlProfile["actionPolicy"], value: boolean) {
    onProfileChange({
      ...profile,
      actionPolicy: { ...profile.actionPolicy, [key]: value },
    });
  }

  function addWorkflowNote() {
    const note = `${t("advanced.workflowNote")} ${profile.workflowNotes.length + 1}.`;
    update({ workflowNotes: [...profile.workflowNotes, note] });
  }

  function clearWorkflowNotes() {
    update({ workflowNotes: [] });
  }

  return (
    <section className="panel advanced-control-suite">
      <div>
        <div className="panel-header">{t("advanced.header")}</div>
        <p className="status-text">{t("advanced.description")}</p>
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.mode")}</span>
        <div className="mode-grid">
          {(["browser", "computer", "hybrid"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={profile.mode === mode ? "mode-card active" : "mode-card"}
              onClick={() => update({ mode })}
            >
              <strong>{t(modeLabels[mode])}</strong>
              <span>
                {mode === "browser"
                  ? t("advanced.browserHint")
                  : mode === "computer"
                    ? t("advanced.computerHint")
                    : t("advanced.hybridHint")}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.actionPolicy")}</span>
        <div className="policy-grid">
          {actionOptions.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={profile.actionPolicy[key]}
                onChange={(event) => updatePolicy(key, event.target.checked)}
              />
              {t(actionLabelKey(label))}
            </label>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.approvalRules")}</span>
        <div className="policy-grid">
          {approvalOptions.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={profile.actionPolicy[key]}
                onChange={(event) => updatePolicy(key, event.target.checked)}
              />
              {t(approvalLabelKey(label))}
            </label>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.scenarios")}</span>
        <div className="scenario-list">
          {scenarioPacks.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onApplyScenario(localizeScenario(scenario, locale))}
            >
              <strong>{localizeScenario(scenario, locale).label}</strong>
              <span>{localizeScenario(scenario, locale).description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.recorder")}</span>
        <div className="recorder-row">
          <button type="button" onClick={addWorkflowNote}>
            {t("advanced.addWorkflowNote")}
          </button>
          <button type="button" onClick={clearWorkflowNotes} disabled={!profile.workflowNotes.length}>
            {t("advanced.clear")}
          </button>
        </div>
        {profile.workflowNotes.length ? (
          <ol className="workflow-notes">
            {profile.workflowNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ol>
        ) : (
          <div className="status-text">{t("advanced.recorderEmpty")}</div>
        )}
      </div>

      <div className="control-section">
        <span className="eyebrow">{t("advanced.viewportLab")}</span>
        <div className="viewport-grid">
          {viewportPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={profile.viewportId === preset.id ? "viewport-card active" : "viewport-card"}
              onClick={() => update({ viewportId: preset.id })}
            >
              <strong>{preset.label}</strong>
              <span>
                {preset.width}x{preset.height}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function actionLabelKey(label: string): TranslationKey {
  const map: Record<string, TranslationKey> = {
    Click: "advanced.click",
    Type: "advanced.type",
    Scroll: "advanced.scroll",
    Download: "advanced.download",
    "File access": "advanced.fileAccess",
    Shell: "advanced.shell",
  };
  return map[label];
}

function approvalLabelKey(label: string): TranslationKey {
  const map: Record<string, TranslationKey> = {
    Submits: "advanced.submits",
    "External nav": "advanced.externalNav",
    Destructive: "advanced.destructive",
  };
  return map[label];
}

function localizeScenario(scenario: ScenarioPack, locale: string): ScenarioPack {
  if (locale !== "zh-CN") return scenario;
  const zh: Record<string, Pick<ScenarioPack, "label" | "description" | "task">> = {
    "research-report": {
      label: "研究报告",
      description: "比较来源、引用证据并生成简洁报告。",
      task: "跨多个可信网页来源研究目标主题。捕获证据，比较冲突观点，并输出包含来源链接、假设和后续问题的简洁报告。",
    },
    "form-fill": {
      label: "表单填写",
      description: "使用参考资料填写表单，提交前停止。",
      task: "使用提供的参考文件填写目标网页表单。逐项验证字段。在提交、上传、购买或修改账号设置前停止并请求人工确认。",
    },
    "web-qa": {
      label: "网页 QA",
      description: "执行网页流程并返回高优先级问题。",
      task: "打开目标 Web 应用。检查布局、导航、表单、按钮、控制台可见错误和移动端尺寸行为。返回按优先级排序的 QA 报告，并在有帮助时附带截图。",
    },
    "product-monitor": {
      label: "商品监控",
      description: "收集商品数据、价格、评论和库存。",
      task: "访问目标商品页面。提取名称、价格、评分、评论数、库存状态、配送说明和来源 URL。将结构化结果保存到工作区，并总结购买取舍。",
    },
    "content-ops": {
      label: "内容运营",
      description: "草拟和预览内容，发布前需要确认。",
      task: "为目标平台草拟内容，在 UI 中预览，并在发布、发送、删除或修改账号设置前停止等待人工确认。",
    },
  };
  return { ...scenario, ...zh[scenario.id] };
}
