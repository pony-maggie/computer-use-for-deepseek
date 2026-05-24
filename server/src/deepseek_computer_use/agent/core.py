import re
from collections.abc import Callable
from typing import Any, Protocol

from deepseek_computer_use.agent.events import AgentRunResult
from deepseek_computer_use.agent.prompts import SYSTEM_PROMPT
from deepseek_computer_use.models.protocol import AgentStatus, ToolResult
from deepseek_computer_use.runtime.base import ComputerRuntime
from deepseek_computer_use.safety.policy import SafetyDecision, SafetyPolicy


ProgressCallback = Callable[[str, dict[str, Any]], None]


class ModelAdapter(Protocol):
    def complete(self, messages: list[dict[str, Any]]) -> Any:
        raise NotImplementedError

    def tool_result_message(self, tool_call_id: str, content: str) -> dict[str, str]:
        raise NotImplementedError


class AgentCore:
    def __init__(
        self,
        *,
        model: ModelAdapter,
        runtime: ComputerRuntime,
        safety: SafetyPolicy,
        max_steps: int,
        token_budget: int = 0,
        cost_budget_usd: float = 0.0,
        input_usd_per_mtok: float = 0.0,
        output_usd_per_mtok: float = 0.0,
        on_event: ProgressCallback | None = None,
    ) -> None:
        self.model = model
        self.runtime = runtime
        self.safety = safety
        self.max_steps = max_steps
        self.token_budget = token_budget
        self.cost_budget_usd = cost_budget_usd
        self.input_usd_per_mtok = input_usd_per_mtok
        self.output_usd_per_mtok = output_usd_per_mtok
        self.on_event = on_event
        self.seen_image_hashes: set[str] = set()

    async def run(self, task: str) -> AgentRunResult:
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task},
        ]
        return await self._run_loop(
            messages=messages,
            start_step=1,
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=0,
            estimated_cost_usd=0.0,
        )

    async def continue_after_confirmation(
        self,
        *,
        messages: list[dict[str, Any]],
        pending_tool_call: Any,
        steps: int,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        prompt_cache_hit_tokens: int,
        prompt_cache_miss_tokens: int,
        estimated_cost_usd: float,
    ) -> AgentRunResult:
        result = await self.runtime.execute(pending_tool_call)
        result = self._compact_tool_result(result)
        messages.append(self.model.tool_result_message(pending_tool_call.tool_call_id, result))
        return await self._run_loop(
            messages=messages,
            start_step=steps + 1,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            estimated_cost_usd=estimated_cost_usd,
        )

    async def _run_loop(
        self,
        *,
        messages: list[dict[str, Any]],
        start_step: int,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        prompt_cache_hit_tokens: int,
        prompt_cache_miss_tokens: int,
        estimated_cost_usd: float,
    ) -> AgentRunResult:
        for step in range(start_step, self.max_steps + 1):
            previous_prompt_tokens = prompt_tokens
            previous_completion_tokens = completion_tokens
            previous_total_tokens = total_tokens
            previous_cache_hit_tokens = prompt_cache_hit_tokens
            previous_cache_miss_tokens = prompt_cache_miss_tokens
            previous_cost = estimated_cost_usd
            self._emit("model", f"Step {step}: waiting for model response", status="running", step=step)
            parsed = self.model.complete(messages)
            prompt_tokens += getattr(parsed, "prompt_tokens", 0)
            completion_tokens += getattr(parsed, "completion_tokens", 0)
            total_tokens += getattr(parsed, "total_tokens", 0)
            prompt_cache_hit_tokens += getattr(parsed, "prompt_cache_hit_tokens", 0)
            prompt_cache_miss_tokens += getattr(parsed, "prompt_cache_miss_tokens", 0)
            estimated_cost_usd = self._estimate_cost_usd(
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
            )
            usage_delta = {
                "prompt_tokens": prompt_tokens - previous_prompt_tokens,
                "completion_tokens": completion_tokens - previous_completion_tokens,
                "total_tokens": total_tokens - previous_total_tokens,
                "prompt_cache_hit_tokens": prompt_cache_hit_tokens - previous_cache_hit_tokens,
                "prompt_cache_miss_tokens": prompt_cache_miss_tokens - previous_cache_miss_tokens,
                "estimated_cost_usd": round(estimated_cost_usd - previous_cost, 6),
            }
            messages.append(parsed.assistant_message)
            if self.token_budget and total_tokens > self.token_budget:
                return AgentRunResult(
                    status=AgentStatus.failed.value,
                    final_text="token budget exceeded",
                    steps=step,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                    prompt_cache_miss_tokens=prompt_cache_miss_tokens,
                    estimated_cost_usd=estimated_cost_usd,
                )
            if self.cost_budget_usd and estimated_cost_usd > self.cost_budget_usd:
                return AgentRunResult(
                    status=AgentStatus.failed.value,
                    final_text="cost budget exceeded",
                    steps=step,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                    prompt_cache_miss_tokens=prompt_cache_miss_tokens,
                    estimated_cost_usd=estimated_cost_usd,
                )
            if parsed.final_text is not None:
                self._emit(
                    "model",
                    f"Step {step}: model returned final answer",
                    status="completed",
                    step=step,
                    usage_delta=usage_delta,
                )
            else:
                tool_call_count = len(parsed.tool_calls)
                noun = "tool call" if tool_call_count == 1 else "tool calls"
                self._emit(
                    "model",
                    f"Step {step}: model requested {tool_call_count} {noun}",
                    status="completed",
                    step=step,
                    usage_delta=usage_delta,
                )
            if parsed.final_text is not None:
                self._emit("result", f"Step {step}: completed run", status="completed", step=step)
                return AgentRunResult(
                    status=AgentStatus.completed.value,
                    final_text=parsed.final_text,
                    steps=step,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                    prompt_cache_miss_tokens=prompt_cache_miss_tokens,
                    estimated_cost_usd=estimated_cost_usd,
                )
            for tool_call in parsed.tool_calls:
                decision = self.safety.evaluate(tool_call)
                if decision == SafetyDecision.BLOCK:
                    self._emit(
                        "safety",
                        f"Step {step}: blocked {self._summarize_tool_call(tool_call)}",
                        status="blocked",
                        step=step,
                        **self._tool_event_payload(tool_call),
                    )
                    messages.append(
                        self.model.tool_result_message(
                            tool_call.tool_call_id,
                            '{"error": "action blocked by safety policy"}',
                        )
                    )
                    continue
                if decision == SafetyDecision.CONFIRM:
                    summary = self._summarize_tool_call(tool_call)
                    self._emit(
                        "confirmation",
                        f"Step {step}: waiting for approval for {summary}",
                        status="waiting",
                        step=step,
                        **self._tool_event_payload(tool_call),
                    )
                    return AgentRunResult(
                        status=AgentStatus.waiting_for_confirmation.value,
                        final_text="waiting for user confirmation",
                        steps=step,
                        prompt_tokens=prompt_tokens,
                        completion_tokens=completion_tokens,
                        total_tokens=total_tokens,
                        prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                        prompt_cache_miss_tokens=prompt_cache_miss_tokens,
                        estimated_cost_usd=estimated_cost_usd,
                        pending_tool_call=tool_call,
                        agent_messages=messages,
                    )
                summary = self._summarize_tool_call(tool_call)
                tool_payload = self._tool_event_payload(tool_call)
                self._emit(
                    "tool",
                    f"Step {step}: executing {summary}",
                    status="running",
                    step=step,
                    **tool_payload,
                )
                result = await self.runtime.execute(tool_call)
                result = self._compact_tool_result(result)
                messages.append(self.model.tool_result_message(tool_call.tool_call_id, result))
                completed_payload = {**tool_payload, **self._result_event_payload(result)}
                self._emit(
                    "tool",
                    f"Step {step}: completed {summary}",
                    status="failed" if result.error else "completed",
                    step=step,
                    **completed_payload,
                )
        return AgentRunResult(
            status=AgentStatus.failed.value,
            final_text="max steps reached",
            steps=self.max_steps,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            estimated_cost_usd=estimated_cost_usd,
        )

    def _emit(self, kind: str, message: str, **payload: Any) -> None:
        if self.on_event is not None:
            self.on_event(kind, {"message": message, **payload})

    def _summarize_tool_call(self, tool_call: Any) -> str:
        if getattr(tool_call, "bash", None) is not None:
            return f"bash: {tool_call.bash.command}"
        if getattr(tool_call, "text_editor", None) is not None:
            return f"text_editor {tool_call.text_editor.command}: {tool_call.text_editor.path}"
        if getattr(tool_call, "computer", None) is not None:
            return f"computer: {tool_call.computer.action}"
        return getattr(tool_call, "name", "tool call")

    def _estimate_cost_usd(self, *, prompt_tokens: int, completion_tokens: int) -> float:
        input_cost = prompt_tokens / 1_000_000 * self.input_usd_per_mtok
        output_cost = completion_tokens / 1_000_000 * self.output_usd_per_mtok
        return round(input_cost + output_cost, 6)

    def _tool_event_payload(self, tool_call: Any) -> dict[str, Any]:
        if getattr(tool_call, "computer", None) is not None:
            action = tool_call.computer
            return {
                "tool_name": "computer",
                "action_name": str(action.action),
                "action_payload": action.model_dump(mode="json"),
                "display": {
                    "width": self.safety.display_width,
                    "height": self.safety.display_height,
                    "scale": 1.0,
                },
            }
        if getattr(tool_call, "bash", None) is not None:
            return {
                "tool_name": "bash",
                "action_name": "shell",
                "action_payload": tool_call.bash.model_dump(mode="json"),
            }
        if getattr(tool_call, "text_editor", None) is not None:
            return {
                "tool_name": "text_editor",
                "action_name": str(tool_call.text_editor.command),
                "action_payload": tool_call.text_editor.model_dump(mode="json"),
            }
        return {"tool_name": getattr(tool_call, "name", "tool")}

    def _result_event_payload(self, result: ToolResult) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "result_summary": result.output,
            "error": result.error,
        }
        if result.image_hash or result.base64_image:
            payload["screenshot"] = {
                "mime_type": "image/png",
                "base64": result.base64_image,
                "hash": result.image_hash,
                "cache_hit": result.perception_cache_hit,
            }
        display = self._display_from_system(result.system)
        if display is not None:
            payload["display"] = display
        return payload

    def _display_from_system(self, system: str | None) -> dict[str, float | int] | None:
        if not system:
            return None
        match = re.search(r"display=(\d+)x(\d+)", system)
        if match is None:
            return None
        return {"width": int(match.group(1)), "height": int(match.group(2)), "scale": 1.0}

    def _compact_tool_result(self, result: ToolResult) -> ToolResult:
        if not result.image_hash or not result.base64_image:
            return result
        if result.image_hash not in self.seen_image_hashes:
            self.seen_image_hashes.add(result.image_hash)
            return result

        system = result.system or ""
        suffix = f"unchanged screenshot omitted; image_hash={result.image_hash}"
        return result.model_copy(
            update={
                "base64_image": None,
                "perception_cache_hit": True,
                "system": f"{system}; {suffix}" if system else suffix,
            }
        )
