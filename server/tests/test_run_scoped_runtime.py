import pytest

from deepseek_computer_use.models.protocol import TextEditorAction, ToolCall, ToolResult
from deepseek_computer_use.runtime.base import ComputerRuntime
from deepseek_computer_use.runtime.run_scoped_runtime import RunScopedRuntime


class RecordingRuntime(ComputerRuntime):
    def __init__(self) -> None:
        self.calls: list[ToolCall] = []

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        self.calls.append(tool_call)
        return ToolResult(output="ok")


@pytest.mark.asyncio
async def test_scopes_root_workspace_output_file_to_run_outputs() -> None:
    runtime = RecordingRuntime()
    scoped = RunScopedRuntime(runtime=runtime, run_id="run_123")

    await scoped.execute(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="/workspace/output.txt",
                file_text="hello",
            ),
        )
    )

    assert runtime.calls[0].text_editor is not None
    assert runtime.calls[0].text_editor.path == "/workspace/run_123/outputs/output.txt"


@pytest.mark.asyncio
async def test_scopes_relative_output_file_to_run_outputs() -> None:
    runtime = RecordingRuntime()
    scoped = RunScopedRuntime(runtime=runtime, run_id="run_123")

    await scoped.execute(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="output.txt",
                file_text="hello",
            ),
        )
    )

    assert runtime.calls[0].text_editor is not None
    assert runtime.calls[0].text_editor.path == "/workspace/run_123/outputs/output.txt"


@pytest.mark.asyncio
async def test_scopes_uploaded_workspace_file_to_current_run() -> None:
    runtime = RecordingRuntime()
    scoped = RunScopedRuntime(runtime=runtime, run_id="run_123")

    await scoped.execute(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="view",
                path="/workspace/uploads/input.md",
            ),
        )
    )

    assert runtime.calls[0].text_editor is not None
    assert runtime.calls[0].text_editor.path == "/workspace/run_123/uploads/input.md"


@pytest.mark.asyncio
async def test_keeps_current_run_absolute_path() -> None:
    runtime = RecordingRuntime()
    scoped = RunScopedRuntime(runtime=runtime, run_id="run_123")

    await scoped.execute(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="view",
                path="/workspace/run_123/uploads/input.md",
            ),
        )
    )

    assert runtime.calls[0].text_editor is not None
    assert runtime.calls[0].text_editor.path == "/workspace/run_123/uploads/input.md"
