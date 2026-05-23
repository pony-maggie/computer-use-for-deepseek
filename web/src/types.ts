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

export type RunEvent = {
  kind: string;
  message: string;
};
