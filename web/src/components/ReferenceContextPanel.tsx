import { ChangeEvent, useState } from "react";
import { useI18n } from "../i18n";
import {
  buildReferenceContextBlock,
  buildReferenceContextItem,
  type ReferenceContextItem,
} from "./referenceContext";

type Props = {
  onContextChange: (context: string, items: ReferenceContextItem[]) => void;
};

export function ReferenceContextPanel({ onContextChange }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<ReferenceContextItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setError(null);
    try {
      const nextItems = [...items, ...(await Promise.all(files.map(buildReferenceContextItem)))];
      setItems(nextItems);
      onContextChange(buildReferenceContextBlock(nextItems), nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("references.failed"));
    }
  }

  function clearReferences() {
    setItems([]);
    onContextChange("", []);
  }

  return (
    <section className="panel reference-panel">
      <div className="panel-header">{t("references.header")}</div>
      <input type="file" multiple onChange={onFilesSelected} />
      {items.length ? (
        <>
          <div className="status-text">
            {items.length} {t("references.appended")}
          </div>
          <ul className="reference-list">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.type}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearReferences}>
            {t("references.clear")}
          </button>
        </>
      ) : (
        <div className="status-text">{t("references.empty")}</div>
      )}
      {error ? <div className="error-text">{error}</div> : null}
    </section>
  );
}
