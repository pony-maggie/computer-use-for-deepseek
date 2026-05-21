from abc import ABC, abstractmethod

from deepseek_computer_use.models.protocol import ToolCall, ToolResult


class ComputerRuntime(ABC):
    @abstractmethod
    async def execute(self, tool_call: ToolCall) -> ToolResult:
        raise NotImplementedError
