import { ChangeEvent, useState } from "react";
import {
  buildReferenceContextBlock,
  buildReferenceContextItem,
  type ReferenceContextItem,
} from "./referenceContext";

type Props = {
  onContextChange: (context: string, items: ReferenceContextItem[]) => void;
};

export function ReferenceContextPanel({ onContextChange }: Props) {
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
      setError(err instanceof Error ? err.message : "Failed to read reference files");
    }
  }

  function clearReferences() {
    setItems([]);
    onContextChange("", []);
  }

  return (
    <section className="panel reference-panel">
      <div className="panel-header">References</div>
      <input type="file" multiple onChange={onFilesSelected} />
      {items.length ? (
        <>
          <div className="status-text">{items.length} reference item(s) will be appended to new runs.</div>
          <ul className="reference-list">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.type}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearReferences}>
            Clear References
          </button>
        </>
      ) : (
        <div className="status-text">Attach local articles, screenshots, notes, or data as task context.</div>
      )}
      {error ? <div className="error-text">{error}</div> : null}
    </section>
  );
}
