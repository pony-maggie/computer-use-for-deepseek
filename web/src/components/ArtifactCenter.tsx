import { useEffect, useState } from "react";
import { fileDownloadUrl, listFiles } from "../api";
import type { Run, RunEvent, WorkspaceFile } from "../types";

type Props = {
  run: Run | null;
  events: RunEvent[];
};

export function ArtifactCenter({ run, events }: Props) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function refreshFiles() {
      if (!run) {
        setFiles([]);
        return;
      }
      setError(null);
      try {
        const nextFiles = await listFiles(run.run_id);
        if (active) setFiles(nextFiles);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load artifacts");
      }
    }
    void refreshFiles();
    return () => {
      active = false;
    };
  }, [run?.run_id, run?.updated_at, run?.status]);

  const screenshots = events.filter((event) => event.screenshot?.base64).slice(-6);

  return (
    <section className="panel artifact-center">
      <div className="panel-header">Artifacts</div>
      {run?.final_text ? <p className="artifact-final">{run.final_text}</p> : null}
      {error ? <div className="error-text">{error}</div> : null}
      {files.length ? (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.relative_path}>
              <a href={fileDownloadUrl(run!.run_id, file.relative_path)} download>
                {file.relative_path}
              </a>
              <span>{file.size_bytes} bytes</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="status-text">Output files and final results will appear here.</div>
      )}
      {screenshots.length ? (
        <div className="artifact-screenshots">
          {screenshots.map((event, index) => (
            <img
              key={`${event.id ?? event.sequence ?? index}`}
              alt=""
              src={`data:${event.screenshot!.mime_type};base64,${event.screenshot!.base64}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
