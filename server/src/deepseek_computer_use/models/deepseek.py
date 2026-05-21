import json
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from deepseek_computer_use.models.protocol import (
    BashAction,
    ComputerAction,
    TextEditorAction,
    ToolCall,
    ToolResult,
)


@dataclass(frozen=True)
class ParsedModelResponse:
    assistant_message: dict[str, Any]
    final_text: str | None
    tool_calls: list[ToolCall]
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0


class DeepSeekAdapter:
    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str,
        thinking: str = "enabled",
        reasoning_effort: str = "high",
    ) -> None:
        self.model = model
        self.thinking = thinking
        self.reasoning_effort = reasoning_effort
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def tool_schema(self) -> list[dict[str, Any]]:
        return [
            self._computer_tool_schema(),
            self._bash_tool_schema(),
            self._text_editor_tool_schema(),
        ]

    def _computer_tool_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "computer",
                "description": "Control the sandbox desktop with screenshot, mouse, and keyboard actions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": [
                                "screenshot",
                                "browser_snapshot",
                                "open_url",
                                "left_click",
                                "double_click",
                                "right_click",
                                "mouse_move",
                                "type",
                                "key",
                                "wait",
                            ],
                        },
                        "coordinate": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "Pointer coordinate [x, y] when required.",
                        },
                        "text": {"type": "string"},
                        "key": {"type": "string"},
                        "duration_ms": {"type": "integer", "minimum": 0, "maximum": 60000},
                    },
                    "required": ["action"],
                },
            },
        }

    def _bash_tool_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "bash",
                "description": "Run a shell command inside the sandbox workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {"type": "string"},
                        "restart": {"type": "boolean"},
                    },
                    "required": ["command"],
                },
            },
        }

    def _text_editor_tool_schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "text_editor",
                "description": "View, create, or edit text files inside the sandbox workspace.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "enum": ["view", "create", "str_replace"],
                        },
                        "path": {"type": "string"},
                        "file_text": {"type": "string"},
                        "old_str": {"type": "string"},
                        "new_str": {"type": "string"},
                    },
                    "required": ["command", "path"],
                },
            },
        }

    def complete(self, messages: list[dict[str, Any]]) -> ParsedModelResponse:
        extra_body: dict[str, Any] = {}
        if self.thinking == "enabled":
            extra_body["thinking"] = {"type": "enabled"}

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=self.tool_schema(),
            reasoning_effort=self.reasoning_effort,
            extra_body=extra_body,
        )
        return self.parse_response(response)

    def parse_response(self, response: Any) -> ParsedModelResponse:
        message = response.choices[0].message
        tool_calls: list[ToolCall] = []
        raw_tool_calls = getattr(message, "tool_calls", None) or []
        serialized_tool_calls: list[dict[str, Any]] = []

        for raw_call in raw_tool_calls:
            name = raw_call.function.name
            data = json.loads(raw_call.function.arguments)
            if name == "computer":
                tool_calls.append(
                    ToolCall(
                        tool_call_id=raw_call.id,
                        name=name,
                        computer=ComputerAction.model_validate(data),
                    )
                )
            elif name == "bash":
                tool_calls.append(
                    ToolCall(
                        tool_call_id=raw_call.id,
                        name=name,
                        bash=BashAction.model_validate(data),
                    )
                )
            elif name == "text_editor":
                tool_calls.append(
                    ToolCall(
                        tool_call_id=raw_call.id,
                        name=name,
                        text_editor=TextEditorAction.model_validate(data),
                    )
                )
            else:
                raise ValueError(f"unsupported tool call {name}")
            serialized_tool_calls.append(
                {
                    "id": raw_call.id,
                    "type": "function",
                    "function": {
                        "name": name,
                        "arguments": raw_call.function.arguments,
                    },
                }
            )

        assistant_message = {
            "role": "assistant",
            "content": getattr(message, "content", None) or "",
        }
        reasoning_content = getattr(message, "reasoning_content", None)
        if reasoning_content is not None:
            assistant_message["reasoning_content"] = reasoning_content
        if serialized_tool_calls:
            assistant_message["tool_calls"] = serialized_tool_calls

        usage = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
        prompt_cache_hit_tokens = int(getattr(usage, "prompt_cache_hit_tokens", 0) or 0)
        prompt_cache_miss_tokens = int(getattr(usage, "prompt_cache_miss_tokens", 0) or 0)

        return ParsedModelResponse(
            assistant_message=assistant_message,
            final_text=None if tool_calls else assistant_message["content"],
            tool_calls=tool_calls,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
        )

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult) -> dict[str, str]:
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}
