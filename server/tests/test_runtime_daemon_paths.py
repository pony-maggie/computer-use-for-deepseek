from pathlib import Path
import importlib.util
import json


def load_daemon_module():
    daemon_path = Path(__file__).resolve().parents[2] / "runtime" / "daemon.py"
    spec = importlib.util.spec_from_file_location("runtime_daemon_for_tests", daemon_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_workspace_path_accepts_absolute_workspace_path(tmp_path) -> None:
    daemon = load_daemon_module()
    daemon.WORKSPACE = tmp_path

    target = daemon.workspace_path(f"{tmp_path}/run_123/uploads/input.md")

    assert target == tmp_path / "run_123/uploads/input.md"


def test_workspace_path_rejects_absolute_path_outside_workspace(tmp_path) -> None:
    daemon = load_daemon_module()
    daemon.WORKSPACE = tmp_path

    try:
        daemon.workspace_path("/etc/passwd")
    except ValueError as exc:
        assert "path escapes workspace" in str(exc)
    else:
        raise AssertionError("expected workspace_path to reject path outside workspace")


def test_open_url_returns_browser_snapshot_without_base64_screenshot(monkeypatch) -> None:
    daemon = load_daemon_module()
    opened_urls: list[str] = []

    def fail_popen(command, **kwargs):
        raise AssertionError("open_url should navigate the remote-debugging browser tab")

    def fake_urlopen(request, timeout=None):
        opened_urls.append(f"{request.get_method()} {request.full_url}")
        return object()

    monkeypatch.setattr(daemon.subprocess, "Popen", fail_popen)
    monkeypatch.setattr(daemon.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(daemon.time, "sleep", lambda seconds: None)
    monkeypatch.setattr(
        daemon,
        "browser_snapshot",
        lambda: {
            "title": "Example Domain",
            "url": "https://example.com/",
            "dom": "<html><title>Example Domain</title></html>",
        },
    )

    def fail_screenshot():
        raise AssertionError("open_url should use browser_snapshot instead of base64 screenshot")

    monkeypatch.setattr(daemon, "screenshot", fail_screenshot)

    result = daemon.handle_computer({"action": "open_url", "text": "example.com"})

    assert opened_urls == ["PUT http://localhost:9222/json/new?http%3A//example.com"]
    assert "base64_image" not in result
    assert result["system"] == "browser_snapshot=dom_first"
    assert json.loads(result["output"])["title"] == "Example Domain"


def test_resize_viewport_updates_framebuffer_and_browser_window(monkeypatch) -> None:
    daemon = load_daemon_module()
    commands: list[list[str]] = []

    def fake_run_checked(command, *, cwd=None):
        commands.append(command)

    monkeypatch.setattr(daemon, "run_checked", fake_run_checked)

    result = daemon.handle_computer(
        {"action": "resize_viewport", "width": 390, "height": 844, "label": "Mobile 390x844"}
    )

    assert result == {
        "output": "resized viewport to 390x844",
        "system": "viewport=390x844 label=Mobile 390x844",
    }
    assert ["xrandr", "--fb", "390x844"] in commands
    assert [
        "xdotool",
        "search",
        "--onlyvisible",
        "--class",
        "chromium",
        "windowmove",
        "%@",
        "0",
        "0",
        "windowsize",
        "%@",
        "390",
        "844",
    ] in commands


def test_browser_snapshot_prefers_non_blank_browser_tab(monkeypatch) -> None:
    daemon = load_daemon_module()

    class FakeResponse:
        def __init__(self, payload: str) -> None:
            self.payload = payload.encode("utf-8")

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self) -> bytes:
            return self.payload

    def fake_urlopen(url, timeout=None):
        return FakeResponse(
            json.dumps(
                [
                    {"type": "page", "url": "about:blank", "title": "about:blank"},
                    {"type": "page", "url": "http://example.com/", "title": "Example Domain"},
                ]
            )
        )

    run_calls: list[list[str]] = []

    def fake_run(command, *, timeout=None, cwd=None):
        run_calls.append(command)
        return "<html><title>Example Domain</title></html>", "", 0

    monkeypatch.setattr(daemon.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(daemon, "run", fake_run)

    snapshot = daemon.browser_snapshot()

    assert snapshot["title"] == "Example Domain"
    assert snapshot["url"] == "http://example.com/"
    assert run_calls[0][-1] == "http://example.com/"
