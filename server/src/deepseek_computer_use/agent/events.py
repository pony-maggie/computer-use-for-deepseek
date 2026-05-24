from dataclasses import dataclass
from typing import Any, Literal

from deepseek_computer_use.models.protocol import ToolCall

EventKind = Literal["model", "tool", "runtime", "safety", "confirmation", "result", "system"]
EventStatus = Literal["pending", "running", "completed", "failed", "blocked", "waiting"]


@dataclass(frozen=True)
class StructuredRunEvent:
    kind: EventKind
    message: str
    status: EventStatus = "completed"
    step: int | None = None
    tool_name: str | None = None
    action_name: str | None = None
    action_payload: dict[str, Any] | None = None
    result_summary: str | None = None
    error: str | None = None
    screenshot: dict[str, Any] | None = None
    display: dict[str, Any] | None = None
    usage_delta: dict[str, Any] | None = None

    def to_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"message": self.message, "status": self.status}
        for key in (
            "step",
            "tool_name",
            "action_name",
            "action_payload",
            "result_summary",
            "error",
            "screenshot",
            "display",
            "usage_delta",
        ):
            value = getattr(self, key)
            if value is not None:
                payload[key] = value
        return payload


def normalize_event_payload(
    *,
    kind: str,
    payload: dict[str, Any],
    event_id: int | None = None,
    run_id: str | None = None,
    created_at: str | None = None,
) -> dict[str, Any]:
    return {
        "id": str(event_id) if event_id is not None else None,
        "run_id": run_id,
        "sequence": event_id,
        "kind": kind,
        "message": str(payload.get("message", "")),
        "status": payload.get("status", "completed"),
        "step": payload.get("step"),
        "tool_name": payload.get("tool_name"),
        "action_name": payload.get("action_name"),
        "action_payload": payload.get("action_payload"),
        "result_summary": payload.get("result_summary"),
        "error": payload.get("error"),
        "screenshot": payload.get("screenshot"),
        "display": payload.get("display"),
        "usage_delta": payload.get("usage_delta"),
        "created_at": created_at,
    }


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
