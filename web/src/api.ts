import type { Run, RunEvent, RunHistoryItem, WorkspaceFile } from "./types";

const API_ORIGIN = "http://localhost:8000";
const API_BASE = `${API_ORIGIN}/api`;
const API_UNREACHABLE_MESSAGE =
  "Backend API is still starting or is unreachable. Wait a moment, then try again.";

export type VoiceInterpretRequest = {
  transcript: string;
  language: string;
  current_task: string;
  run_status: string | null;
  has_pending_confirmation: boolean;
};

export type VoiceInterpretation = {
  task_text_delta: string;
  actions: Array<"create_run" | "start_run" | "pause_run" | "resume_run" | "cancel_run" | "clear_input">;
  manual_confirmation_required: boolean;
  needs_clarification?: boolean;
  message: string | null;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
};

async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(API_UNREACHABLE_MESSAGE);
    }
    throw err;
  }
}

export async function getApiHealth(): Promise<boolean> {
  try {
    const response = await fetchApi(`${API_ORIGIN}/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createRun(task: string): Promise<Run> {
  const response = await fetchApi(`${API_BASE}/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task }),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function interpretVoice(request: VoiceInterpretRequest): Promise<VoiceInterpretation> {
  const response = await fetchApi(`${API_BASE}/voice/interpret`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function getRun(runId: string): Promise<Run> {
  const response = await fetchApi(`${API_BASE}/runs/${runId}`, { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function listRuns(): Promise<RunHistoryItem[]> {
  const response = await fetchApi(`${API_BASE}/runs`, { cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function startRun(runId: string): Promise<Run> {
  return runAction(runId, "start");
}

export async function pauseRun(runId: string): Promise<Run> {
  return runAction(runId, "pause");
}

export async function resumeRun(runId: string): Promise<Run> {
  return runAction(runId, "resume");
}

export async function cancelRun(runId: string): Promise<Run> {
  return runAction(runId, "cancel");
}

export async function approveRun(runId: string): Promise<Run> {
  return runAction(runId, "approve");
}

export async function rejectRun(runId: string): Promise<Run> {
  return runAction(runId, "reject");
}

async function runAction(runId: string, action: string): Promise<Run> {
  const response = await fetchApi(`${API_BASE}/runs/${runId}/${action}`, { method: "POST" });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function uploadFile(runId: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetchApi(`${API_BASE}/runs/${runId}/files`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
}

export async function listFiles(runId: string): Promise<WorkspaceFile[]> {
  const response = await fetchApi(`${API_BASE}/runs/${runId}/files`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function listEvents(runId: string): Promise<RunEvent[]> {
  const response = await fetchApi(`${API_BASE}/runs/${runId}/events`);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function fileDownloadUrl(runId: string, relativePath: string): string {
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/runs/${runId}/files/${encodedPath}`;
}
