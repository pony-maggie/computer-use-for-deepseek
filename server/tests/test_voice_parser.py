from types import SimpleNamespace

from deepseek_computer_use.voice.parser import VoiceIntentParser


class FakeCompletions:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.payload


class FakeClient:
    def __init__(self, payload):
        self.chat = SimpleNamespace(completions=FakeCompletions(payload))


def _model_response(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(
            prompt_tokens=10,
            completion_tokens=4,
            total_tokens=14,
            prompt_cache_hit_tokens=0,
            prompt_cache_miss_tokens=0,
        ),
    )


def test_mixed_utterance_maps_task_and_actions() -> None:
    parser = VoiceIntentParser(
        model="deepseek-v4-flash",
        api_key="test",
        base_url="https://api.deepseek.com",
        client=FakeClient(
            _model_response(
                '{"task_text_delta":"打开浏览器，访问 baidu.com","actions":["create_run","start_run"],"manual_confirmation_required":false,"message":null}'
            )
        ),
    )

    result = parser.interpret(
        transcript="打开浏览器，访问 baidu.com，开始运行",
        language="zh-CN",
        current_task="",
        run_status="created",
        has_pending_confirmation=False,
    )

    assert result.task_text_delta == "打开浏览器，访问 baidu.com"
    assert result.actions == ["create_run", "start_run"]
    assert result.manual_confirmation_required is False


def test_approval_speech_is_manual_only() -> None:
    parser = VoiceIntentParser(
        model="deepseek-v4-flash",
        api_key="test",
        base_url="https://api.deepseek.com",
        client=FakeClient(
            _model_response(
                '{"task_text_delta":"","actions":[],"manual_confirmation_required":true,"message":"Please approve or reject pending confirmations manually."}'
            )
        ),
    )

    result = parser.interpret(
        transcript="批准",
        language="zh-CN",
        current_task="",
        run_status="waiting_for_confirmation",
        has_pending_confirmation=True,
    )

    assert result.task_text_delta == ""
    assert result.actions == []
    assert result.manual_confirmation_required is True
