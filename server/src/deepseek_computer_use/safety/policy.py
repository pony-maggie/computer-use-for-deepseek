from enum import Enum
import shlex

from deepseek_computer_use.models.protocol import ActionName, ToolCall


class SafetyDecision(Enum):
    ALLOW = "allow"
    CONFIRM = "confirm"
    BLOCK = "block"


class SafetyPolicy:
    def __init__(self, *, display_width: int, display_height: int) -> None:
        self.display_width = display_width
        self.display_height = display_height

    def evaluate(self, tool_call: ToolCall) -> SafetyDecision:
        if tool_call.bash is not None:
            if self._is_low_risk_browser_command(tool_call.bash.command):
                return SafetyDecision.ALLOW
            if self._is_low_risk_workspace_read_command(tool_call.bash.command):
                return SafetyDecision.ALLOW
            return SafetyDecision.CONFIRM
        if tool_call.text_editor is not None:
            if self._is_low_risk_file_view(
                command=tool_call.text_editor.command,
                path=tool_call.text_editor.path,
            ):
                return SafetyDecision.ALLOW
            return SafetyDecision.CONFIRM
        if tool_call.computer is None:
            return SafetyDecision.BLOCK

        action = tool_call.computer
        try:
            action.validate_for_display(width=self.display_width, height=self.display_height)
        except ValueError:
            return SafetyDecision.BLOCK

        if action.action == ActionName.type and action.text:
            lowered = action.text.lower()
            if "password" in lowered or "credit card" in lowered:
                return SafetyDecision.CONFIRM
        return SafetyDecision.ALLOW

    def _is_low_risk_browser_command(self, command: str) -> bool:
        normalized = " ".join(command.strip().split())
        if normalized == 'which firefox chromium-browser google-chrome chromium 2>/dev/null || echo "not found"':
            return True
        if self._is_simple_browser_discovery(normalized):
            return True
        if self._is_browser_which_discovery(normalized):
            return True
        if self._is_browser_process_discovery(normalized):
            return True
        if self._is_browser_package_discovery(normalized):
            return True
        if self._is_browser_restart_launch(normalized):
            return True

        background = normalized.endswith("&")
        if background:
            normalized = normalized[:-1].strip()
        try:
            parts = shlex.split(normalized)
        except ValueError:
            return False
        if not parts or parts[0] not in {"chromium", "chromium-browser", "google-chrome", "firefox"}:
            return False

        forbidden = {"--user-data-dir=/workspace", "--profile-directory"}
        if any(part in forbidden for part in parts):
            return False
        return any(
            part.startswith(("http://", "https://")) or "." in part
            for part in parts[1:]
            if not part.startswith("-")
        )

    def _tokenize_shell(self, normalized: str) -> list[str]:
        lexer = shlex.shlex(normalized, posix=True, punctuation_chars="|;&")
        lexer.whitespace_split = True
        return list(lexer)

    def _is_simple_browser_discovery(self, normalized: str) -> bool:
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        browsers = {"firefox", "chromium", "google-chrome", "chromium-browser"}
        if len(parts) < 2 or len(parts) % 3 != 2:
            return False
        for index, part in enumerate(parts):
            position = index % 3
            if position == 0 and part != "which":
                return False
            if position == 1 and part not in browsers:
                return False
            if position == 2 and part != "||":
                return False
        return True

    def _is_browser_which_discovery(self, normalized: str) -> bool:
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        browsers = {"firefox", "chromium", "google-chrome", "chromium-browser"}
        if len(parts) < 2 or parts[0] != "which":
            return False
        allowed = browsers | {"which", "2>/dev/null", "||", "echo", "not found", "checking browsers..."}
        return all(part in allowed for part in parts) and any(part in browsers for part in parts)

    def _is_browser_process_discovery(self, normalized: str) -> bool:
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        allowed = {
            "ps",
            "aux",
            "|",
            "grep",
            "-i",
            "-v",
            "firefox",
            "chrom",
            "chromium",
            "chrome",
            ";",
            "echo",
            "---",
            "DISPLAY=$DISPLAY",
        }
        required_prefix = ["ps", "aux", "|", "grep", "-i"]
        if parts[:5] != required_prefix:
            return False
        return all(part in allowed for part in parts) and any(
            part in {"firefox", "chrom", "chromium", "chrome"} for part in parts
        )

    def _is_browser_restart_launch(self, normalized: str) -> bool:
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        allowed = {
            "pkill",
            "firefox",
            "chromium",
            "google-chrome",
            "chromium-browser",
            "sleep",
            "1",
            "2",
            "3",
            "5",
            ";",
            "&",
            "echo",
            "done",
            "2>/dev/null",
            "--no-sandbox",
            "--disable-gpu",
            "--new-window",
        }
        if any(part not in allowed and not self._is_urlish(part) for part in parts):
            return False
        if "pkill" in parts:
            pkill_index = parts.index("pkill")
            if pkill_index + 1 >= len(parts) or parts[pkill_index + 1] not in {
                "firefox",
                "chromium",
                "google-chrome",
                "chromium-browser",
            }:
                return False
        browser_indexes = [
            index
            for index, part in enumerate(parts)
            if part in {"firefox", "chromium", "google-chrome", "chromium-browser"}
            and (index == 0 or parts[index - 1] != "pkill")
        ]
        return any(any(self._is_urlish(part) for part in parts[index + 1 :]) for index in browser_indexes)

    def _is_urlish(self, value: str) -> bool:
        return value.startswith(("http://", "https://")) or "." in value

    def _is_low_risk_workspace_read_command(self, command: str) -> bool:
        normalized = " ".join(command.strip().split())
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        if not parts or "|" in parts:
            return False

        commands: list[list[str]] = []
        current: list[str] = []
        for part in parts:
            if part in {";", "&&", "||"}:
                if current:
                    commands.append(current)
                    current = []
                continue
            current.append(part)
        if current:
            commands.append(current)

        return bool(commands) and all(
            self._is_low_risk_workspace_read_segment(segment) for segment in commands
        )

    def _is_low_risk_workspace_read_segment(self, segment: list[str]) -> bool:
        segment = [part for part in segment if part != "2>/dev/null"]
        if not segment:
            return True

        command = segment[0]
        args = segment[1:]
        if command == "echo":
            return True
        if command == "pwd":
            return not args
        if command == "ls":
            return all(
                arg in {"-l", "-a", "-la", "-al"} or self._is_workspace_read_path(arg)
                for arg in args
            )
        if command == "cat":
            return bool(args) and all(self._is_workspace_read_path(arg) for arg in args)
        if command == "find":
            return self._is_workspace_find_segment(args)
        return False

    def _is_workspace_find_segment(self, args: list[str]) -> bool:
        if len(args) < 3 or args[0] not in {"/", "/workspace", "/workspace/"}:
            return False
        index = 1
        saw_name = False
        while index < len(args):
            if args[index] == "-name" and index + 1 < len(args):
                name = args[index + 1]
                if "/" in name or name in {"", ".", ".."} or name.startswith("-"):
                    return False
                saw_name = True
                index += 2
                continue
            if args[index] == "-type" and index + 1 < len(args) and args[index + 1] == "f":
                index += 2
                continue
            if args[index] == "-maxdepth" and index + 1 < len(args):
                if args[index + 1] not in {"1", "2", "3", "4", "5"}:
                    return False
                index += 2
                continue
            return False
        return saw_name

    def _is_workspace_read_path(self, path: str) -> bool:
        if not path or "\x00" in path or ".." in path.split("/"):
            return False
        return (
            path in {".", "uploads", "uploads/", "/workspace", "/workspace/"}
            or path.startswith("uploads/")
            or path.startswith("./uploads/")
            or path.startswith("/workspace/")
            or path.startswith("/workspace/*")
            or path.startswith("run_")
        )

    def _is_low_risk_file_view(self, *, command: str, path: str) -> bool:
        if command != "view":
            return False
        normalized_path = path.strip()
        if not normalized_path or "\x00" in normalized_path:
            return False
        parts = normalized_path.split("/")
        if ".." in parts:
            return False
        return not normalized_path.startswith("/") or normalized_path.startswith("/workspace/")

    def _is_browser_package_discovery(self, normalized: str) -> bool:
        allowed = {
            "which",
            "firefox",
            "chromium",
            "google-chrome",
            "chromium-browser",
            "apt",
            "list",
            "--installed",
            "grep",
            "-i",
            "-E",
            "firefox|chromium|chrome",
            "echo",
            "---",
            "true",
            "2>/dev/null",
            "||",
            "|",
            ";",
        }
        try:
            parts = self._tokenize_shell(normalized)
        except ValueError:
            return False
        if not parts:
            return False
        return all(part in allowed for part in parts) and "apt" in parts and "grep" in parts
