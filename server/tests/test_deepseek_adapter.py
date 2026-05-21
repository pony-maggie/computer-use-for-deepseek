from types import SimpleNamespace

from deepseek_computer_use.models.deepseek import DeepSeekAdapter


def test_tool_schema_exposes_claude_style_tool_families() -> None:
    adapter = DeepSeekAdapter(
        model="deepseek-v4-pro", api_key="key", base_url="https://api.deepseek.com"
    )

    tools = adapter.tool_schema()
    names = [tool["function"]["name"] for tool in tools]

    assert names == ["computer", "bash", "text_editor"]
    assert tools[0]["function"]["parameters"]["properties"]["action"]["type"] == "string"
    computer_actions = tools[0]["function"]["parameters"]["properties"]["action"]["enum"]
    assert "browser_snapshot" in computer_actions


def test_parse_tool_call_into_computer_tool_payload() -> None:
    adapter = DeepSeekAdapter(
        model="deepseek-v4-pro", api_key="key", base_url="https://api.deepseek.com"
    )
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content="",
                    reasoning_content="thinking",
                    tool_calls=[
                        SimpleNamespace(
                            id="call_1",
                            function=SimpleNamespace(
                                name="computer",
                                arguments='{"action":"left_click","coordinate":[10,20]}',
                            ),
                        )
                    ],
                )
            )
        ],
        usage=SimpleNamespace(
            prompt_tokens=100,
            completion_tokens=20,
            total_tokens=120,
            prompt_cache_hit_tokens=70,
            prompt_cache_miss_tokens=30,
        ),
    )

    parsed = adapter.parse_response(response)

    assert parsed.final_text is None
    assert parsed.tool_calls[0].tool_call_id == "call_1"
    assert parsed.tool_calls[0].computer is not None
    assert parsed.tool_calls[0].computer.coordinate == (10, 20)
    assert parsed.assistant_message["reasoning_content"] == "thinking"
    assert parsed.total_tokens == 120
    assert parsed.prompt_cache_hit_tokens == 70
    assert parsed.prompt_cache_miss_tokens == 30


def test_parse_bash_tool_call() -> None:
    adapter = DeepSeekAdapter(
        model="deepseek-v4-pro", api_key="key", base_url="https://api.deepseek.com"
    )
    response = SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(
                    content="",
                    tool_calls=[
                        SimpleNamespace(
                            id="call_2",
                            function=SimpleNamespace(
                                name="bash",
                                arguments='{"command":"ls -la"}',
                            ),
                        )
                    ],
                )
            )
        ]
    )

    parsed = adapter.parse_response(response)

    assert parsed.tool_calls[0].bash is not None
    assert parsed.tool_calls[0].bash.command == "ls -la"
