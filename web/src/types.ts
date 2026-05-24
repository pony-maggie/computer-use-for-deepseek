export type Run = {
  run_id: string;
  task: string;
  status: string;
  final_text?: string | null;
  steps: number;
  max_steps: number;
  model: string;
  token_budget: number;
  cost_budget_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  estimated_cost_usd: number;
  created_at?: string;
  updated_at?: string;
  pending_confirmation?: unknown | null;
  pending_confirmation_summary?: string | null;
};

export type RunHistoryItem = {
  run_id: string;
  task: string;
  status: string;
  final_text?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkspaceFile = {
  relative_path: string;
  size_bytes: number;
};

export type RunEventStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "waiting";

export type RunEvent = {
  id?: string | null;
  run_id?: string | null;
  sequence?: number | null;
  kind: string;
  status?: RunEventStatus | string | null;
  message: string;
  step?: number | null;
  tool_name?: "computer" | "bash" | "text_editor" | string | null;
  action_name?: string | null;
  action_payload?: Record<string, unknown> | null;
  result_summary?: string | null;
  error?: string | null;
  screenshot?: {
    mime_type: string;
    path?: string | null;
    base64?: string | null;
    hash?: string | null;
    cache_hit?: boolean;
  } | null;
  display?: {
    width: number;
    height: number;
    scale: number;
  } | null;
  usage_delta?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
    estimated_cost_usd: number;
  } | null;
  created_at?: string | null;
};
