import httpx
import pytest

from deepseek_computer_use.models.protocol import ComputerAction, ToolCall
from deepseek_computer_use.runtime.docker_runtime import DockerRuntime


@pytest.mark.asyncio
async def test_docker_runtime_posts_tool_call_to_runtime_daemon() -> None:
    requests: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(__import__("json").loads(request.content))
        return httpx.Response(
            200,
            json={
                "output": "executed screenshot",
                "base64_image": "aW1hZ2U=",
                "image_hash": "sha256:image",
                "system": "display=1280x800",
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    runtime = DockerRuntime(action_url="http://runtime:7070", client=client)

    result = await runtime.execute(
        ToolCall(
            tool_call_id="call_1",
            name="computer",
            computer=ComputerAction(action="screenshot"),
        )
    )

    await client.aclose()
    assert requests[0]["name"] == "computer"
    assert requests[0]["computer"]["action"] == "screenshot"
    assert result.base64_image == "aW1hZ2U="
    assert result.image_hash == "sha256:image"
