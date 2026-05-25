#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile

DISPLAY = os.environ.get("DISPLAY", ":1")
WORKSPACE = Path(os.environ.get("WORKSPACE_ROOT", "/workspace")).resolve()
DISPLAY_WIDTH = os.environ.get("WIDTH", "1440")
DISPLAY_HEIGHT = os.environ.get("HEIGHT", "1112")
DOM_SNAPSHOT_LIMIT = int(os.environ.get("DOM_SNAPSHOT_LIMIT", "12000"))


def run(
    command: list[str], *, cwd: Path | None = None, timeout: int | None = None
) -> tuple[str, str, int]:
    try:
        process = subprocess.run(
            command,
            cwd=cwd,
            env={**os.environ, "DISPLAY": DISPLAY},
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        return exc.stdout or "", exc.stderr or "command timed out", 124
    return process.stdout, process.stderr, process.returncode


def run_checked(command: list[str], *, cwd: Path | None = None) -> None:
    stdout, stderr, code = run(command, cwd=cwd)
    if code != 0:
        raise RuntimeError(stderr or stdout or f"command failed with exit code {code}")


def workspace_path(path: str) -> Path:
    raw_path = Path(path)
    target = raw_path.resolve() if raw_path.is_absolute() else (WORKSPACE / raw_path).resolve()
    workspace = WORKSPACE.resolve()
    if target != workspace and workspace not in target.parents:
        raise ValueError("path escapes workspace")
    return target


def screenshot() -> tuple[str, str]:
    with NamedTemporaryFile(suffix=".png") as tmp:
        stdout, stderr, code = run(["import", "-window", "root", tmp.name])
        if code != 0:
            raise RuntimeError(stderr or stdout or "screenshot failed")
        image_bytes = Path(tmp.name).read_bytes()
        digest = hashlib.sha256(image_bytes).hexdigest()
        return base64.b64encode(image_bytes).decode("ascii"), f"sha256:{digest}"


def browser_snapshot() -> dict:
    try:
        with urllib.request.urlopen("http://localhost:9222/json", timeout=2) as response:
            pages = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        return {"error": f"browser snapshot unavailable: {exc}"}

    page = next(
        (
            item
            for item in pages
            if item.get("type") == "page"
            and str(item.get("url", "")).startswith(("http://", "https://", "file://"))
        ),
        next((item for item in pages if item.get("type") == "page"), pages[0] if pages else {}),
    )
    url = page.get("url", "")
    title = page.get("title", "")
    result: dict[str, str] = {"title": title, "url": url}

    if url.startswith(("http://", "https://", "file://")):
        stdout, stderr, code = run(
            [
                "chromium",
                "--headless",
                "--no-sandbox",
                "--disable-gpu",
                "--dump-dom",
                url,
            ],
            timeout=15,
        )
        if code == 0:
            result["dom"] = stdout[:DOM_SNAPSHOT_LIMIT]
        else:
            result["dom_error"] = stderr or stdout or f"dump-dom failed with exit code {code}"
    return result


def handle_computer(payload: dict) -> dict:
    global DISPLAY_WIDTH, DISPLAY_HEIGHT
    action = payload["action"]
    if action == "browser_snapshot":
        return {
            "output": json.dumps(browser_snapshot(), ensure_ascii=False),
            "system": "browser_snapshot=dom_first",
        }
    if action == "resize_viewport":
        width = int(payload.get("width", 0))
        height = int(payload.get("height", 0))
        label = str(payload.get("label", f"{width}x{height}"))
        if width < 320 or width > 1440 or height < 480 or height > 1112:
            return {"error": "viewport dimensions out of range"}
        try:
            run_checked(["xrandr", "--fb", f"{width}x{height}"])
        except RuntimeError:
            # Some Xvfb builds do not support RandR framebuffer changes. Keep
            # the browser-window resize path active so the runtime viewport
            # still changes inside the available display.
            pass
        run_checked(
            [
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
                str(width),
                str(height),
            ]
        )
        DISPLAY_WIDTH = str(width)
        DISPLAY_HEIGHT = str(height)
        return {
            "output": f"resized viewport to {width}x{height}",
            "system": f"viewport={width}x{height} label={label}",
        }
    if action == "open_url":
        url = payload.get("text", "").strip()
        if not url:
            return {"error": "open_url requires text"}
        if not url.startswith(("http://", "https://")):
            url = f"http://{url}"
        encoded_url = urllib.parse.quote(url, safe="/")
        urllib.request.urlopen(
            urllib.request.Request(
                f"http://localhost:9222/json/new?{encoded_url}",
                method="PUT",
            ),
            timeout=5,
        )
        time.sleep(2)
        return {
            "output": json.dumps(browser_snapshot(), ensure_ascii=False),
            "system": "browser_snapshot=dom_first",
        }
    elif action == "left_click":
        x, y = payload["coordinate"]
        run_checked(["xdotool", "mousemove", str(x), str(y), "click", "1"])
    elif action == "double_click":
        x, y = payload["coordinate"]
        run_checked(["xdotool", "mousemove", str(x), str(y), "click", "--repeat", "2", "1"])
    elif action == "right_click":
        x, y = payload["coordinate"]
        run_checked(["xdotool", "mousemove", str(x), str(y), "click", "3"])
    elif action == "mouse_move":
        x, y = payload["coordinate"]
        run_checked(["xdotool", "mousemove", str(x), str(y)])
    elif action == "type":
        run_checked(["xdotool", "type", "--delay", "5", payload.get("text", "")])
    elif action == "key":
        run_checked(["xdotool", "key", payload.get("key", "")])
    elif action == "wait":
        time.sleep(payload.get("duration_ms", 0) / 1000)
    elif action != "screenshot":
        return {"error": f"unsupported computer action {action}"}
    image, image_hash = screenshot()
    return {
        "output": f"executed {action}",
        "base64_image": image,
        "image_hash": image_hash,
        "system": f"display={DISPLAY_WIDTH}x{DISPLAY_HEIGHT}",
    }


def handle_bash(payload: dict) -> dict:
    command = payload["command"]
    if command.strip().endswith("&"):
        subprocess.Popen(
            ["bash", "-lc", command],
            cwd=WORKSPACE,
            env={**os.environ, "DISPLAY": DISPLAY},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        return {"output": "started background command"}

    stdout, stderr, code = run(["bash", "-lc", command], cwd=WORKSPACE, timeout=30)
    if code != 0:
        return {"output": stdout or None, "error": stderr or f"exit code {code}"}
    return {"output": stdout}


def handle_text_editor(payload: dict) -> dict:
    path = workspace_path(payload["path"])
    command = payload["command"]
    if command == "view":
        return {"output": path.read_text(encoding="utf-8")}
    if command == "create":
        if path.exists():
            return {"error": f"file already exists: {path.relative_to(WORKSPACE)}"}
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(payload.get("file_text", ""), encoding="utf-8")
        return {"output": f"created {path.relative_to(WORKSPACE)}"}
    if command == "str_replace":
        text = path.read_text(encoding="utf-8")
        old = payload.get("old_str", "")
        if old not in text:
            return {"error": "old_str not found"}
        path.write_text(text.replace(old, payload.get("new_str", ""), 1), encoding="utf-8")
        return {"output": f"updated {path.relative_to(WORKSPACE)}"}
    return {"error": f"unsupported text_editor command {command}"}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        if self.path != "/tool-call":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            if body["name"] == "computer":
                result = handle_computer(body["computer"])
            elif body["name"] == "bash":
                result = handle_bash(body["bash"])
            elif body["name"] == "text_editor":
                result = handle_text_editor(body["text_editor"])
            else:
                result = {"error": f"unsupported tool {body['name']}"}
            self._write_json(result)
        except Exception as exc:
            self._write_json({"error": str(exc)})

    def _write_json(self, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    WORKSPACE.mkdir(parents=True, exist_ok=True)
    HTTPServer(("0.0.0.0", 7070), Handler).serve_forever()
