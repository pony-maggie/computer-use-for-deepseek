from dataclasses import dataclass
from typing import Any

from deepseek_computer_use.models.protocol import ToolCall


@dataclass(frozen=True)
class AgentRunResult:
    status: str
    final_text: str | None
    steps: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0
    estimated_cost_usd: float = 0.0
    pending_tool_call: ToolCall | None = None
    agent_messages: list[dict[str, Any]] | None = None
