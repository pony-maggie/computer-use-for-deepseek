from fastapi.testclient import TestClient

from deepseek_computer_use.main import create_app


def test_health_endpoint_smoke() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_run_endpoint_smoke() -> None:
    client = TestClient(create_app())

    response = client.post("/api/runs", json={"task": "Take a screenshot"})

    assert response.status_code == 200
    assert response.json()["run_id"].startswith("run_")
    assert response.json()["status"] == "created"
