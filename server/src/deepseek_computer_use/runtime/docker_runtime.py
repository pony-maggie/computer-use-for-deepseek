import httpx

from deepseek_computer_use.models.protocol import ToolCall, ToolResult
from deepseek_computer_use.runtime.base import ComputerRuntime


class DockerRuntime(ComputerRuntime):
    def __init__(
        self,
        *,
        action_url: str,
        width: int = 1280,
        height: int = 800,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.action_url = action_url.rstrip("/")
        self.width = width
        self.height = height
        self.client = client

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        if tool_call.computer is not None:
            tool_call.computer.validate_for_display(width=self.width, height=self.height)
        if self.client is not None:
            response = await self.client.post(
                f"{self.action_url}/tool-call",
                json=tool_call.model_dump(mode="json", exclude_none=True),
            )
            response.raise_for_status()
            return ToolResult.model_validate(response.json())

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.action_url}/tool-call",
                json=tool_call.model_dump(mode="json", exclude_none=True),
            )
        response.raise_for_status()
        return ToolResult.model_validate(response.json())
