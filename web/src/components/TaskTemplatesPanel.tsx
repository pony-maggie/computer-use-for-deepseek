export type TaskTemplate = {
  id: string;
  label: string;
  task: string;
};

const templates: TaskTemplate[] = [
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

type Props = {
  onSelectTemplate: (template: TaskTemplate) => void;
};

export function TaskTemplatesPanel({ onSelectTemplate }: Props) {
  return (
    <section className="panel template-panel">
      <div className="panel-header">Templates</div>
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
