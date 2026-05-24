import { ChangeEvent, useEffect, useState } from "react";
import { fileDownloadUrl, listFiles, uploadFile } from "../api";
import { useI18n } from "../i18n";
import type { WorkspaceFile } from "../types";
import { getWorkspaceUploadState } from "./workspaceUploadState";

type Props = {
  runId: string | null;
  runStatus: string;
  runUpdatedAt: string | null;
};

export function WorkspacePanel({ runId, runStatus, runUpdatedAt }: Props) {
  const { t } = useI18n();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  async function refresh() {
    if (!runId) {
      setFiles([]);
      return;
    }
    setError(null);
    try {
      setFiles(await listFiles(runId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspace.failedLoad"));
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;
    event.target.value = "";

    if (!runId) {
      setStagedFiles((current) => [...current, ...selectedFiles]);
      return;
    }

    setError(null);
    setUploading(true);
    try {
      for (const file of selectedFiles) {
        await uploadFile(runId, file);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspace.failedUpload"));
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [runId, runStatus, runUpdatedAt]);

  useEffect(() => {
    if (!runId || stagedFiles.length === 0) return;

    let active = true;

    async function uploadStagedFiles() {
      setError(null);
      setUploading(true);
      try {
        for (const file of stagedFiles) {
          await uploadFile(runId!, file);
        }
        if (!active) return;
        setStagedFiles([]);
        await refresh();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t("workspace.failedUpload"));
      } finally {
        if (active) setUploading(false);
      }
    }

    void uploadStagedFiles();
    return () => {
      active = false;
    };
  }, [runId, stagedFiles]);

  const uploadState = getWorkspaceUploadState({
    runId,
    stagedFileCount: stagedFiles.length,
    uploading,
    uploadingMessage: t("workspace.uploading"),
    readySingularMessage: t("workspace.fileReady"),
    readyPluralMessage: t("workspace.filesReady"),
  });

  return (
    <section className="panel">
      <div className="panel-header">{t("workspace.header")}</div>
      <input type="file" disabled={uploadState.inputDisabled} multiple onChange={onUpload} />
      {uploadState.message ? <div className="status-text">{uploadState.message}</div> : null}
      {error ? <div className="error-text">{error}</div> : null}
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.relative_path}>
            <a
              href={runId ? fileDownloadUrl(runId, file.relative_path) : "#"}
              download={downloadName(file.relative_path)}
            >
              {file.relative_path}
            </a>
            <span>{file.size_bytes} bytes</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function downloadName(relativePath: string) {
  return relativePath.split("/").pop() || relativePath;
}
