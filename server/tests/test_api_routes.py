from fastapi.testclient import TestClient

from deepseek_computer_use.api.routes import (
    RunState,
    _apply_run_result,
    _build_agent,
    _get_run,
    _session_factory,
    runs,
)
from deepseek_computer_use.agent.events import AgentRunResult
from deepseek_computer_use.main import create_app
from deepseek_computer_use.models.protocol import BashAction, ToolCall
from deepseek_computer_use.persistence.database import session_scope
from deepseek_computer_use.persistence.repositories import RunRepository
from deepseek_computer_use.voice.parser import VoiceInterpretation


def test_create_run_endpoint() -> None:
    client = TestClient(create_app())

    response = client.post("/api/runs", json={"task": "Take a screenshot"})

    assert response.status_code == 200
    assert response.json()["run_id"].startswith("run_")
    assert response.json()["status"] == "created"
    assert response.json()["max_steps"] > 0
    assert response.json()["token_budget"] > 0
    assert "cost_budget_usd" in response.json()
    assert "model" in response.json()
    assert "prompt_cache_hit_tokens" in response.json()
    assert "prompt_cache_miss_tokens" in response.json()
    assert "pending_confirmation" in response.json()
    assert "pending_confirmation_summary" in response.json()
    assert "created_at" in response.json()
    assert "updated_at" in response.json()


def test_voice_interpret_endpoint(monkeypatch) -> None:
    client = TestClient(create_app())

    class FakeParser:
        def interpret(self, **kwargs):
            assert kwargs["transcript"] == "打开浏览器，访问 baidu.com，开始运行"
            assert kwargs["language"] == "zh-CN"
            return VoiceInterpretation(
                task_text_delta="打开浏览器，访问 baidu.com",
                actions=["create_run", "start_run"],
                manual_confirmation_required=False,
                message=None,
            )

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._build_voice_intent_parser",
        lambda: FakeParser(),
    )

    response = client.post(
        "/api/voice/interpret",
        json={
            "transcript": "打开浏览器，访问 baidu.com，开始运行",
            "language": "zh-CN",
            "current_task": "",
            "run_status": "created",
            "has_pending_confirmation": False,
        },
    )

    assert response.status_code == 200
    assert response.json()["task_text_delta"] == "打开浏览器，访问 baidu.com"
    assert response.json()["actions"] == ["create_run", "start_run"]
    assert response.json()["manual_confirmation_required"] is False


def test_set_sandbox_viewport_forwards_to_runtime(monkeypatch) -> None:
    client = TestClient(create_app())
    forwarded: list[dict[str, object]] = []

    def fake_post_runtime_tool_call(payload: dict[str, object]) -> dict[str, object]:
        forwarded.append(payload)
        return {"output": "resized viewport to 390x844", "system": "viewport=390x844"}

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._post_runtime_tool_call",
        fake_post_runtime_tool_call,
        raising=False,
    )

    response = client.post(
        "/api/sandbox/viewport",
        json={"width": 390, "height": 844, "label": "Mobile 390x844"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "width": 390,
        "height": 844,
        "label": "Mobile 390x844",
        "applied": True,
    }
    assert forwarded == [
        {
            "name": "computer",
            "computer": {
                "action": "resize_viewport",
                "width": 390,
                "height": 844,
                "label": "Mobile 390x844",
            },
        }
    ]


def test_set_sandbox_viewport_rejects_invalid_dimensions(monkeypatch) -> None:
    client = TestClient(create_app())
    forwarded: list[dict[str, object]] = []

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._post_runtime_tool_call",
        lambda payload: forwarded.append(payload),
        raising=False,
    )

    response = client.post(
        "/api/sandbox/viewport",
        json={"width": 100, "height": 100, "label": "Tiny"},
    )

    assert response.status_code == 422
    assert forwarded == []


def test_get_run_endpoint_returns_current_run_state() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "Take a screenshot"}).json()

    response = client.get(f"/api/runs/{created['run_id']}")

    assert response.status_code == 200
    assert response.json()["run_id"] == created["run_id"]
    assert response.json()["status"] == "created"


def test_list_runs_returns_history_with_task_time_and_result() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "Summarize uploaded report"}).json()
    run_id = created["run_id"]

    runs[run_id].status = "completed"
    runs[run_id].final_text = "Report summarized"
    runs[run_id].updated_at = "2026-05-23T10:00:00+00:00"

    response = client.get("/api/runs")

    assert response.status_code == 200
    matching = [item for item in response.json() if item["run_id"] == run_id]
    assert matching == [
        {
            "run_id": run_id,
            "task": "Summarize uploaded report",
            "status": "completed",
            "final_text": "Report summarized",
            "created_at": created["created_at"],
            "updated_at": "2026-05-23T10:00:00+00:00",
        }
    ]


def test_get_run_can_restore_persisted_history_summary() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "Open the saved report"}).json()
    run_id = created["run_id"]
    runs.pop(run_id)

    response = client.get(f"/api/runs/{run_id}")

    assert response.status_code == 200
    assert response.json()["run_id"] == run_id
    assert response.json()["task"] == "Open the saved report"
    assert response.json()["status"] == "created"
    assert response.json()["events"] == []


def test_get_run_restores_persisted_agent_messages_and_pending_confirmation() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "run shell command"}).json()
    run_id = created["run_id"]
    pending = ToolCall(
        tool_call_id="call_restore",
        name="bash",
        bash=BashAction(command="printf persisted"),
    )
    messages = [
        {"role": "system", "content": "system prompt"},
        {"role": "user", "content": "run shell command"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [
                {
                    "id": "call_restore",
                    "type": "function",
                    "function": {
                        "name": "bash",
                        "arguments": '{"command": "printf persisted"}',
                    },
                }
            ],
        },
    ]
    result = AgentRunResult(
        status="waiting_for_confirmation",
        final_text="waiting for user confirmation",
        steps=1,
        prompt_tokens=11,
        completion_tokens=7,
        total_tokens=18,
        prompt_cache_hit_tokens=3,
        prompt_cache_miss_tokens=8,
        estimated_cost_usd=0.0123,
        pending_tool_call=pending,
        agent_messages=messages,
    )

    _apply_run_result(runs[run_id], result)
    runs.pop(run_id)

    restored = _get_run(run_id)

    assert restored.status == "waiting_for_confirmation"
    assert restored.steps == 1
    assert restored.prompt_tokens == 11
    assert restored.completion_tokens == 7
    assert restored.total_tokens == 18
    assert restored.prompt_cache_hit_tokens == 3
    assert restored.prompt_cache_miss_tokens == 8
    assert restored.estimated_cost_usd == 0.0123
    assert restored.pending_confirmation == pending
    assert restored.pending_confirmation_summary == "bash: printf persisted"
    assert restored.agent_messages == messages


def test_local_frontend_origins_are_allowed_for_cors() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/api/runs",
        headers={
            "origin": "http://127.0.0.1:3000",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"


def test_upload_list_and_download_file() -> None:
    client = TestClient(create_app())
    run = client.post("/api/runs", json={"task": "Use this file"}).json()
    run_id = run["run_id"]

    upload = client.post(
        f"/api/runs/{run_id}/files",
        files={"file": ("hello.txt", b"hello", "text/plain")},
    )
    files = client.get(f"/api/runs/{run_id}/files")
    download = client.get(f"/api/runs/{run_id}/files/uploads/hello.txt")

    assert upload.status_code == 200
    assert upload.json() == {"relative_path": "uploads/hello.txt", "size_bytes": 5}
    assert files.status_code == 200
    assert {"relative_path": "uploads/hello.txt", "size_bytes": 5} in files.json()
    assert download.status_code == 200
    assert download.content == b"hello"
    assert download.headers["content-disposition"] == 'attachment; filename="hello.txt"'


def test_run_events_websocket_connects() -> None:
    client = TestClient(create_app())
    run_id = client.post("/api/runs", json={"task": "Take a screenshot"}).json()["run_id"]

    with client.websocket_connect(f"/api/runs/{run_id}/events") as websocket:
        assert websocket.receive_json() == {"kind": "connected", "run_id": run_id}
        assert websocket.receive_json() == {"kind": "created", "message": "Run created"}


def test_start_run_requires_deepseek_api_key() -> None:
    client = TestClient(create_app())
    run_id = client.post("/api/runs", json={"task": "Take a screenshot"}).json()["run_id"]

    response = client.post(f"/api/runs/{run_id}/start")

    assert response.status_code == 400
    assert response.json()["detail"] == "DEEPSEEK_API_KEY is not configured"


def test_run_api_does_not_expose_memory_context(monkeypatch) -> None:
    client = TestClient(create_app())

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._recall_memory_context",
        lambda task: "Memory Context:\n- preference: hidden",
        raising=False,
    )

    response = client.post("/api/runs", json={"task": "summarize report"})

    assert response.status_code == 200
    body = response.json()
    assert "memory" not in body
    assert "Memory Context" not in str(body)


def test_build_agent_receives_recalled_memory_context(monkeypatch) -> None:
    run = RunState(run_id="run_memory", task="summarize report", status="created")

    class FakeAdapter:
        def __init__(self, **kwargs):
            pass

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._recall_memory_context",
        lambda task: "Memory Context:\n- preference: hidden",
        raising=False,
    )
    monkeypatch.setattr("deepseek_computer_use.api.routes.DeepSeekAdapter", FakeAdapter)

    agent = _build_agent(run)

    assert agent.memory_context == "Memory Context:\n- preference: hidden"


def test_apply_run_result_captures_memory_candidate(monkeypatch) -> None:
    captured: list[dict] = []

    class FakeMemoryService:
        def extract_candidates(self, capture):
            assert capture.run_id == "run_capture"
            assert capture.task == "以后都用简体中文简短回答"
            assert capture.final_text == "好的，以后我会用简体中文简短回答。"
            return [
                {
                    "kind": "preference",
                    "summary": "User prefers concise Simplified Chinese responses.",
                    "confidence": 0.85,
                }
            ]

    class FakeMemoryRepository:
        def __init__(self, session):
            pass

        def add_memory(self, **kwargs):
            captured.append(kwargs)

    monkeypatch.setattr(
        "deepseek_computer_use.api.routes._build_memory_service",
        lambda: FakeMemoryService(),
        raising=False,
    )
    monkeypatch.setattr(
        "deepseek_computer_use.api.routes.MemoryRepository",
        FakeMemoryRepository,
        raising=False,
    )

    run = RunState(
        run_id="run_capture",
        task="以后都用简体中文简短回答",
        status="running",
    )
    result = AgentRunResult(
        status="completed",
        final_text="好的，以后我会用简体中文简短回答。",
        steps=1,
    )

    _apply_run_result(run, result)

    assert captured == [
        {
            "kind": "preference",
            "summary": "User prefers concise Simplified Chinese responses.",
            "source_run_id": "run_capture",
            "confidence": 0.85,
        }
    ]


def test_pause_resume_and_cancel_run() -> None:
    client = TestClient(create_app())
    run_id = client.post("/api/runs", json={"task": "Take a screenshot"}).json()["run_id"]

    paused = client.post(f"/api/runs/{run_id}/pause")
    resumed = client.post(f"/api/runs/{run_id}/resume")
    canceled = client.post(f"/api/runs/{run_id}/cancel")

    assert paused.status_code == 200
    assert paused.json()["status"] == "paused"
    assert resumed.status_code == 200
    assert resumed.json()["status"] == "created"
    assert canceled.status_code == 200
    assert canceled.json()["status"] == "canceled"


def test_reject_confirmation_finishes_waiting_run() -> None:
    client = TestClient(create_app())
    run_id = "run_waiting_for_reject"
    runs[run_id] = RunState(
        run_id=run_id,
        task="run shell command",
        status="waiting_for_confirmation",
        pending_confirmation=ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(command="ls"),
        ),
        pending_confirmation_summary="bash: ls",
        agent_messages=[{"role": "system", "content": "test"}],
    )

    response = client.post(f"/api/runs/{run_id}/reject")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "failed"
    assert body["final_text"] == "confirmation rejected"
    assert body["pending_confirmation"] is None


def test_approve_confirmation_returns_running_run(monkeypatch) -> None:
    client = TestClient(create_app())
    run_id = "run_waiting_for_approve"
    pending_tool_call = ToolCall(
        tool_call_id="call_1",
        name="bash",
        bash=BashAction(command="ls"),
    )
    runs[run_id] = RunState(
        run_id=run_id,
        task="run shell command",
        status="waiting_for_confirmation",
        steps=1,
        pending_confirmation=pending_tool_call,
        pending_confirmation_summary="bash: ls",
        agent_messages=[{"role": "system", "content": "test"}],
    )

    class FakeAgent:
        async def continue_after_confirmation(self, **kwargs):
            assert kwargs["pending_tool_call"] == pending_tool_call
            return AgentRunResult(
                status="completed",
                final_text="approved",
                steps=2,
                prompt_tokens=10,
                completion_tokens=5,
                total_tokens=15,
            )

    monkeypatch.setattr("deepseek_computer_use.api.routes._build_agent", lambda run: FakeAgent())

    response = client.post(f"/api/runs/{run_id}/approve")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "running"
    assert body["final_text"] is None
    assert body["pending_confirmation"] is None
    assert {"kind": "confirmation", "message": "Approved bash: ls"} in body["events"]


def test_run_events_are_auditable() -> None:
    client = TestClient(create_app())
    run_id = client.post("/api/runs", json={"task": "Take a screenshot"}).json()["run_id"]

    client.post(f"/api/runs/{run_id}/pause")
    response = client.get(f"/api/runs/{run_id}/events")

    assert response.status_code == 200
    assert any(event["kind"] == "created" and event["message"] == "Run created" for event in response.json())
    assert any(event["kind"] == "status" and event["message"] == "Run paused" for event in response.json())


def test_list_events_returns_structured_payload() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "open example.com"}).json()
    run_id = created["run_id"]
    _append_test_event(
        run_id,
        "tool",
        {
            "message": "Step 1: executing computer: left_click",
            "status": "running",
            "step": 1,
            "tool_name": "computer",
            "action_name": "left_click",
            "action_payload": {"action": "left_click", "coordinate": [320, 240]},
            "display": {"width": 1280, "height": 800, "scale": 1.0},
        },
    )

    response = client.get(f"/api/runs/{run_id}/events")

    assert response.status_code == 200
    events = response.json()
    structured = [event for event in events if event["kind"] == "tool"][-1]
    assert structured["message"] == "Step 1: executing computer: left_click"
    assert structured["status"] == "running"
    assert structured["step"] == 1
    assert structured["tool_name"] == "computer"
    assert structured["action_name"] == "left_click"
    assert structured["action_payload"]["coordinate"] == [320, 240]
    assert structured["display"]["width"] == 1280


def test_list_events_preserves_legacy_payloads() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "open example.com"}).json()
    run_id = created["run_id"]
    _append_test_event(run_id, "system", {"message": "legacy event"})

    response = client.get(f"/api/runs/{run_id}/events")

    assert response.status_code == 200
    legacy = [event for event in response.json() if event["message"] == "legacy event"][0]
    assert legacy["kind"] == "system"
    assert legacy["status"] == "completed"
    assert legacy["tool_name"] is None


def test_list_events_returns_stable_sequence_order() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "open example.com"}).json()
    run_id = created["run_id"]
    _append_test_event(run_id, "system", {"message": "first"})
    _append_test_event(run_id, "system", {"message": "second"})
    _append_test_event(run_id, "system", {"message": "third"})

    response = client.get(f"/api/runs/{run_id}/events")

    assert response.status_code == 200
    tail = response.json()[-3:]
    assert [event["sequence"] for event in tail] == sorted(event["sequence"] for event in tail)


def _append_test_event(run_id: str, kind: str, payload: dict[str, object]) -> None:
    with session_scope(_session_factory) as session:
        RunRepository(session).append_event(run_id, kind, payload)
