from deepseek_computer_use.models.protocol import (
    ComputerAction,
    ToolCall,
    ToolResult,
)
from deepseek_computer_use.runtime.base import ComputerRuntime


class MockRuntime(ComputerRuntime):
    def __init__(self, *, width: int = 1280, height: int = 800) -> None:
        self.width = width
        self.height = height
        self.actions: list[ComputerAction] = []

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        if tool_call.computer is not None:
            return self._execute_computer(tool_call.computer)
        if tool_call.bash is not None:
            return ToolResult(output=f"mock shell: {tool_call.bash.command}")
        if tool_call.text_editor is not None:
            return ToolResult(output=f"mock text_editor: {tool_call.text_editor.command}")
        return ToolResult(error="unsupported mock tool call")

    def _execute_computer(self, action: ComputerAction) -> ToolResult:
        action.validate_for_display(width=self.width, height=self.height)
        self.actions.append(action)
        if action.action == "browser_snapshot":
            return ToolResult(
                output='{"title": "Mock browser", "url": "about:blank"}',
                system="browser_snapshot=dom_first",
            )
        return ToolResult(
            output=f"mock executed {action.action}",
            base64_image="bW9jaw==",
            image_hash="sha256:mock",
            system=f"display={self.width}x{self.height}",
        )
