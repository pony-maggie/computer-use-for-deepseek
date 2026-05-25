import pytest
import json

from deepseek_computer_use.agent.core import AgentCore
from deepseek_computer_use.models.protocol import BashAction, ComputerAction, ToolCall, ToolResult
from deepseek_computer_use.runtime.mock_runtime import MockRuntime
from deepseek_computer_use.safety.policy import SafetyPolicy


class FakeModel:
    def __init__(self) -> None:
        self.calls = 0

    def complete(self, messages):
        self.calls += 1
        if self.calls == 1:
            return type(
                "Parsed",
                (),
                {
                    "assistant_message": {"role": "assistant", "content": ""},
                    "final_text": None,
                    "tool_calls": [
                        ToolCall(
                            tool_call_id="call_1",
                            name="computer",
                            computer=ComputerAction(action="screenshot"),
                        )
                    ],
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15,
                },
            )()
        return type(
            "Parsed",
            (),
            {
                "assistant_message": {"role": "assistant", "content": "done"},
                "final_text": "done",
                "tool_calls": [],
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            },
        )()

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult):
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


class ExpensiveModel:
    def complete(self, messages):
        return type(
            "Parsed",
            (),
            {
                "assistant_message": {"role": "assistant", "content": "done"},
                "final_text": "done",
                "tool_calls": [],
                "prompt_tokens": 1_000_000,
                "completion_tokens": 0,
                "total_tokens": 1_000_000,
                "prompt_cache_hit_tokens": 0,
                "prompt_cache_miss_tokens": 1_000_000,
            },
        )()

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult):
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


class RepeatScreenshotModel:
    def __init__(self) -> None:
        self.calls = 0
        self.tool_messages: list[dict[str, str]] = []

    def complete(self, messages):
        self.calls += 1
        self.tool_messages = [message for message in messages if message["role"] == "tool"]
        if self.calls <= 2:
            return type(
                "Parsed",
                (),
                {
                    "assistant_message": {"role": "assistant", "content": ""},
                    "final_text": None,
                    "tool_calls": [
                        ToolCall(
                            tool_call_id=f"call_{self.calls}",
                            name="computer",
                            computer=ComputerAction(action="screenshot"),
                        )
                    ],
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15,
                    "prompt_cache_hit_tokens": 6,
                    "prompt_cache_miss_tokens": 4,
                },
            )()
        return type(
            "Parsed",
            (),
            {
                "assistant_message": {"role": "assistant", "content": "done"},
                "final_text": "done",
                "tool_calls": [],
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "prompt_cache_hit_tokens": 9,
                "prompt_cache_miss_tokens": 1,
            },
        )()

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult):
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


class StableScreenshotRuntime:
    async def execute(self, tool_call: ToolCall) -> ToolResult:
        return ToolResult(
            output="executed screenshot",
            base64_image="c2FtZQ==",
            image_hash="sha256:same",
            system="display=1280x800",
        )


class ChangingScreenshotRuntime:
    def __init__(self) -> None:
        self.calls = 0

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        self.calls += 1
        return ToolResult(
            output=f"executed screenshot {self.calls}",
            base64_image=f"aW1hZ2Ut{self.calls}",
            image_hash=f"sha256:image-{self.calls}",
            system="display=1280x800",
        )


class LargeOutputModel:
    def __init__(self) -> None:
        self.calls = 0
        self.tool_messages: list[dict[str, str]] = []

    def complete(self, messages):
        self.calls += 1
        self.tool_messages = [message for message in messages if message["role"] == "tool"]
        if self.calls == 1:
            return type(
                "Parsed",
                (),
                {
                    "assistant_message": {"role": "assistant", "content": ""},
                    "final_text": None,
                    "tool_calls": [
                        ToolCall(
                            tool_call_id="call_1",
                            name="computer",
                            computer=ComputerAction(action="browser_snapshot"),
                        )
                    ],
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15,
                    "prompt_cache_hit_tokens": 0,
                    "prompt_cache_miss_tokens": 10,
                },
            )()
        return type(
            "Parsed",
            (),
            {
                "assistant_message": {"role": "assistant", "content": "done"},
                "final_text": "done",
                "tool_calls": [],
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
                "prompt_cache_hit_tokens": 0,
                "prompt_cache_miss_tokens": 10,
            },
        )()

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult):
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


class LargeOutputRuntime:
    async def execute(self, tool_call: ToolCall) -> ToolResult:
        return ToolResult(output="x" * 50_000)


class ConfirmingModel:
    def __init__(self) -> None:
        self.calls = 0
        self.messages_after_approval: list[dict] = []

    def complete(self, messages):
        self.calls += 1
        if self.calls == 1:
            return type(
                "Parsed",
                (),
                {
                    "assistant_message": {"role": "assistant", "content": ""},
                    "final_text": None,
                    "tool_calls": [
                        ToolCall(
                            tool_call_id="call_confirm",
                            name="bash",
                            bash=BashAction(command="printf approved"),
                        )
                    ],
                    "prompt_tokens": 10,
                    "completion_tokens": 5,
                    "total_tokens": 15,
                },
            )()
        self.messages_after_approval = messages
        return type(
            "Parsed",
            (),
            {
                "assistant_message": {"role": "assistant", "content": "approved"},
                "final_text": "approved",
                "tool_calls": [],
                "prompt_tokens": 10,
                "completion_tokens": 5,
                "total_tokens": 15,
            },
        )()

    def tool_result_message(self, tool_call_id: str, content: str | ToolResult):
        if isinstance(content, ToolResult):
            content = content.model_dump_json(exclude_none=True)
        return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


class RecordingRuntime:
    def __init__(self) -> None:
        self.actions: list[ToolCall] = []

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        self.actions.append(tool_call)
        return ToolResult(output="approved")


class RecordingFirstMessageModel(FakeModel):
    def __init__(self) -> None:
        super().__init__()
        self.first_messages: list[dict] = []

    def complete(self, messages):
        if not self.first_messages:
            self.first_messages = list(messages)
        return super().complete(messages)


@pytest.mark.asyncio
async def test_agent_loop_runs_tool_and_returns_final_text() -> None:
    runtime = MockRuntime()
    agent = AgentCore(
        model=FakeModel(),
        runtime=runtime,
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
    )

    result = await agent.run("take a screenshot")

    assert result.status == "completed"
    assert result.final_text == "done"
    assert result.total_tokens == 30
    assert len(runtime.actions) == 1


@pytest.mark.asyncio
async def test_agent_stops_when_estimated_cost_exceeds_budget() -> None:
    agent = AgentCore(
        model=ExpensiveModel(),
        runtime=MockRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
        cost_budget_usd=0.50,
        input_usd_per_mtok=1.00,
        output_usd_per_mtok=0,
    )

    result = await agent.run("expensive task")

    assert result.status == "failed"
    assert result.final_text == "cost budget exceeded"
    assert result.estimated_cost_usd == 1.0


@pytest.mark.asyncio
async def test_agent_omits_duplicate_screenshot_base64_by_hash() -> None:
    model = RepeatScreenshotModel()
    agent = AgentCore(
        model=model,
        runtime=StableScreenshotRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
    )

    result = await agent.run("take repeated screenshots")

    assert result.status == "completed"
    assert result.prompt_cache_hit_tokens == 21
    assert result.prompt_cache_miss_tokens == 9
    first_tool_result = json.loads(model.tool_messages[0]["content"])
    second_tool_result = json.loads(model.tool_messages[1]["content"])
    assert first_tool_result["base64_image"] == "c2FtZQ=="
    assert second_tool_result["image_hash"] == "sha256:same"
    assert second_tool_result["perception_cache_hit"] is True
    assert "base64_image" not in second_tool_result


@pytest.mark.asyncio
async def test_agent_omits_new_screenshots_after_first_image_budget() -> None:
    model = RepeatScreenshotModel()
    agent = AgentCore(
        model=model,
        runtime=ChangingScreenshotRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
    )

    result = await agent.run("take changing screenshots")

    assert result.status == "completed"
    first_tool_result = json.loads(model.tool_messages[0]["content"])
    second_tool_result = json.loads(model.tool_messages[1]["content"])
    assert first_tool_result["base64_image"] == "aW1hZ2Ut1"
    assert second_tool_result["image_hash"] == "sha256:image-2"
    assert second_tool_result["perception_cache_hit"] is True
    assert "base64_image" not in second_tool_result
    assert "screenshot omitted after first image" in second_tool_result["system"]


@pytest.mark.asyncio
async def test_agent_truncates_large_tool_output_before_model_context() -> None:
    model = LargeOutputModel()
    agent = AgentCore(
        model=model,
        runtime=LargeOutputRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
    )

    result = await agent.run("inspect a very large page")

    assert result.status == "completed"
    tool_result = json.loads(model.tool_messages[0]["content"])
    assert len(tool_result["output"]) < 13_000
    assert "tool output truncated from 50000 chars" in tool_result["output"]


@pytest.mark.asyncio
async def test_agent_emits_progress_events_during_model_and_tool_steps() -> None:
    events: list[dict] = []
    agent = AgentCore(
        model=FakeModel(),
        runtime=MockRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
        on_event=lambda kind, payload: events.append({"kind": kind, **payload}),
    )

    result = await agent.run("take a screenshot")

    assert result.status == "completed"
    assert any(
        event["kind"] == "model"
        and event["message"] == "Step 1: waiting for model response"
        and event["status"] == "running"
        and event["step"] == 1
        for event in events
    )
    assert any(
        event["kind"] == "tool"
        and event["action_name"] == "screenshot"
        and event["tool_name"] == "computer"
        for event in events
    )
    assert any(event["kind"] == "result" and event["status"] == "completed" for event in events)


@pytest.mark.asyncio
async def test_agent_can_continue_after_confirmed_tool_call() -> None:
    model = ConfirmingModel()
    runtime = RecordingRuntime()
    agent = AgentCore(
        model=model,
        runtime=runtime,
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
    )

    waiting = await agent.run("run a shell command")

    assert waiting.status == "waiting_for_confirmation"
    assert waiting.pending_tool_call is not None
    assert waiting.pending_tool_call.bash is not None
    assert waiting.agent_messages

    completed = await agent.continue_after_confirmation(
        messages=waiting.agent_messages,
        pending_tool_call=waiting.pending_tool_call,
        steps=waiting.steps,
        prompt_tokens=waiting.prompt_tokens,
        completion_tokens=waiting.completion_tokens,
        total_tokens=waiting.total_tokens,
        prompt_cache_hit_tokens=waiting.prompt_cache_hit_tokens,
        prompt_cache_miss_tokens=waiting.prompt_cache_miss_tokens,
        estimated_cost_usd=waiting.estimated_cost_usd,
    )

    assert completed.status == "completed"
    assert completed.final_text == "approved"
    assert runtime.actions[0].bash is not None
    assert any(message["role"] == "tool" for message in model.messages_after_approval)


@pytest.mark.asyncio
async def test_agent_emits_structured_confirmation_event() -> None:
    events: list[dict] = []
    agent = AgentCore(
        model=ConfirmingModel(),
        runtime=RecordingRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
        on_event=lambda kind, payload: events.append({"kind": kind, **payload}),
    )

    waiting = await agent.run("run a shell command")

    assert waiting.status == "waiting_for_confirmation"
    confirmation_event = next(event for event in events if event["kind"] == "confirmation")
    assert confirmation_event["status"] == "waiting"
    assert confirmation_event["step"] == 1
    assert confirmation_event["tool_name"] == "bash"
    assert confirmation_event["action_name"] == "shell"
    assert confirmation_event["action_payload"]["command"] == "printf approved"


@pytest.mark.asyncio
async def test_agent_injects_hidden_memory_context_when_provided() -> None:
    model = RecordingFirstMessageModel()
    agent = AgentCore(
        model=model,
        runtime=MockRuntime(),
        safety=SafetyPolicy(display_width=1280, display_height=800),
        max_steps=5,
        memory_context="Memory Context:\n- preference: User prefers concise Simplified Chinese responses.",
    )

    await agent.run("summarize this report")

    assert model.first_messages[1] == {
        "role": "user",
        "content": (
            "Memory Context:\n"
            "- preference: User prefers concise Simplified Chinese responses.\n\n"
            "Task:\n"
            "summarize this report"
        ),
    }
