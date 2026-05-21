import type { RunEvent } from "../types";

type Props = {
  events: RunEvent[];
  finalText?: string | null;
};

export function Timeline({ events, finalText }: Props) {
  return (
    <section className="panel timeline">
      <div className="panel-header">Audit Trail</div>
      <ol>
        {events.length === 0 ? <li>Run audit events will appear here.</li> : null}
        {events.map((event, index) => (
          <li key={`${event.kind}-${index}`}>
            <strong>{event.kind}</strong>: {event.message}
          </li>
        ))}
        {finalText ? <li>{finalText}</li> : null}
      </ol>
    </section>
  );
}
