from fastapi.testclient import TestClient

from deepseek_computer_use.api.routes import RunState, runs
from deepseek_computer_use.agent.events import AgentRunResult
from deepseek_computer_use.main import create_app
from deepseek_computer_use.models.protocol import BashAction, ToolCall


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


def test_get_run_endpoint_returns_current_run_state() -> None:
    client = TestClient(create_app())
    created = client.post("/api/runs", json={"task": "Take a screenshot"}).json()

    response = client.get(f"/api/runs/{created['run_id']}")

    assert response.status_code == 200
    assert response.json()["run_id"] == created["run_id"]
    assert response.json()["status"] == "created"


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
    assert {"kind": "created", "message": "Run created"} in response.json()
    assert {"kind": "status", "message": "Run paused"} in response.json()
