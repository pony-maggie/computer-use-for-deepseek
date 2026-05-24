import { useI18n } from "../i18n";

export type TaskTemplate = {
  id: string;
  label: string;
  task: string;
};

type Props = {
  onSelectTemplate: (template: TaskTemplate) => void;
};

export function TaskTemplatesPanel({ onSelectTemplate }: Props) {
  const { t, locale } = useI18n();
  const templates = getTemplates(locale);

  return (
    <section className="panel template-panel">
      <div className="panel-header">{t("templates.header")}</div>
      <div className="template-grid">
        {templates.map((template) => (
          <button key={template.id} type="button" onClick={() => onSelectTemplate(template)}>
            {template.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function getTemplates(locale: string): TaskTemplate[] {
  if (locale === "zh-CN") {
    return [
      {
        id: "research",
        label: "研究",
        task: "使用浏览器研究目标主题。比较多个来源，捕获关键证据，并输出包含链接、必要截图和开放问题的简洁报告。",
      },
      {
        id: "web-qa",
        label: "网页 QA",
        task: "打开目标 Web 应用，检查布局、导航、表单、按钮、控制台可见错误和移动端尺寸表现。输出按优先级排序的 QA 报告和复现步骤。",
      },
      {
        id: "data-extraction",
        label: "数据提取",
        task: "访问目标页面并提取结构化数据。将结果保存为工作区中的 CSV 或 JSON，然后总结行数、字段、假设和失败页面。",
      },
      {
        id: "form-fill",
        label: "表单填写",
        task: "使用提供的参考文件填写目标网页表单。在提交、上传、购买或修改账号设置前必须停止并请求确认。",
      },
    ];
  }
  return [
    {
      id: "research",
      label: "Research",
      task:
        "Research the target topic using the browser. Compare multiple sources, capture key evidence, and produce a concise report with links, screenshots if useful, and open questions.",
    },
    {
      id: "web-qa",
      label: "Web QA",
      task:
        "Open the target web app. Check layout, navigation, forms, buttons, console-visible errors, and mobile-sized behavior. Return a prioritized QA report with reproduction steps.",
    },
    {
      id: "data-extraction",
      label: "Data Extraction",
      task:
        "Visit the target pages and extract structured data. Save the result as CSV or JSON in the workspace, then summarize row count, fields, assumptions, and failed pages.",
    },
    {
      id: "form-fill",
      label: "Form Fill",
      task:
        "Use the provided reference files to fill the target web form. Stop for confirmation before submitting, uploading, purchasing, or changing account settings.",
    },
  ];
}
