import posixpath

from deepseek_computer_use.models.protocol import TextEditorCommand, ToolCall, ToolResult
from deepseek_computer_use.runtime.base import ComputerRuntime


class RunScopedRuntime(ComputerRuntime):
    def __init__(self, *, runtime: ComputerRuntime, run_id: str, workspace_root: str = "/workspace"):
        self.runtime = runtime
        self.run_id = run_id
        self.workspace_root = workspace_root.rstrip("/")
        self.run_root = f"{self.workspace_root}/{run_id}"

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        return await self.runtime.execute(self._scope_tool_call(tool_call))

    def _scope_tool_call(self, tool_call: ToolCall) -> ToolCall:
        if tool_call.text_editor is None:
            return tool_call

        text_editor = tool_call.text_editor
        scoped_path = self._scope_text_editor_path(
            path=text_editor.path,
            command=text_editor.command,
        )
        if scoped_path == text_editor.path:
            return tool_call

        return tool_call.model_copy(
            update={"text_editor": text_editor.model_copy(update={"path": scoped_path})}
        )

    def _scope_text_editor_path(self, *, path: str, command: TextEditorCommand) -> str:
        normalized = posixpath.normpath(path)
        if normalized in {"", "."}:
            return path

        if normalized == self.run_root or normalized.startswith(f"{self.run_root}/"):
            return normalized

        if normalized.startswith(f"{self.workspace_root}/run_"):
            return normalized

        if normalized == self.workspace_root:
            return self.run_root

        if normalized.startswith(f"{self.workspace_root}/"):
            relative_path = normalized.removeprefix(f"{self.workspace_root}/")
            return self._scope_relative_path(relative_path=relative_path, command=command)

        if normalized.startswith("/"):
            return normalized

        return self._scope_relative_path(relative_path=normalized, command=command)

    def _scope_relative_path(self, *, relative_path: str, command: TextEditorCommand) -> str:
        if relative_path == ".." or relative_path.startswith("../") or "/../" in relative_path:
            return relative_path

        if command == TextEditorCommand.create and "/" not in relative_path:
            relative_path = f"outputs/{relative_path}"

        return f"{self.run_root}/{relative_path}"
