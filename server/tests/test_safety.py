from deepseek_computer_use.models.protocol import BashAction, ComputerAction, TextEditorAction, ToolCall
from deepseek_computer_use.safety.policy import SafetyDecision, SafetyPolicy


def test_screenshot_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="computer",
            computer=ComputerAction(action="screenshot"),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_out_of_bounds_click_is_blocked() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="computer",
            computer=ComputerAction(action="left_click", coordinate=(1400, 10)),
        )
    )

    assert decision == SafetyDecision.BLOCK


def test_shell_command_requires_confirmation() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(command="rm file.txt"),
        )
    )

    assert decision == SafetyDecision.CONFIRM


def test_browser_discovery_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command='which firefox chromium-browser google-chrome chromium 2>/dev/null || echo "not found"'
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_package_discovery_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    "which firefox || which chromium || which google-chrome || "
                    'which chromium-browser 2>/dev/null; echo "---"; '
                    'apt list --installed 2>/dev/null | grep -i -E "firefox|chromium|chrome" '
                    "2>/dev/null || true"
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_simple_browser_discovery_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command="which firefox || which chromium-browser || which google-chrome || which chromium"
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_discovery_with_echo_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    'which firefox chromium-browser chromium google-chrome 2>/dev/null '
                    '|| echo "checking browsers..."'
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_process_discovery_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(command="ps aux | grep -i firefox | grep -v grep"),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_process_discovery_with_display_echo_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command='ps aux | grep -i chrom | grep -v grep; echo "---"; echo "DISPLAY=$DISPLAY"'
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_launch_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(command="chromium --no-sandbox --disable-gpu example.com &"),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_browser_restart_launch_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    'pkill chromium; sleep 1; chromium --no-sandbox example.com '
                    '2>/dev/null & sleep 3 echo "done"'
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_workspace_file_discovery_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    'find / -name "input.md" 2>/dev/null; '
                    'ls -la /workspace/uploads/ 2>/dev/null || echo "uploads missing"; '
                    "ls -la /workspace/ 2>/dev/null"
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_workspace_file_read_shell_command_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    'pwd && ls -la uploads/ 2>/dev/null || echo "no uploads"; '
                    'echo "---"; '
                    "cat /workspace/run_123/uploads/input.md 2>/dev/null"
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_echo_redirection_requires_confirmation() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(command='echo -n "hello acceptance" > /workspace/hello.txt'),
        )
    )

    assert decision == SafetyDecision.CONFIRM


def test_workspace_file_discovery_with_glob_and_maxdepth_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="bash",
            bash=BashAction(
                command=(
                    "ls -la /workspace/*.md 2>/dev/null; "
                    'find /workspace -name "input.md" -maxdepth 3 2>/dev/null'
                )
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_workspace_file_view_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="view",
                path="/workspace/run_123/uploads/input.md",
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_text_editor_create_outputs_file_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="outputs/example1_report.txt",
                file_text="Summary\n",
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_text_editor_create_run_scoped_outputs_file_is_allowed() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="/workspace/run_123/outputs/example1_report.txt",
                file_text="Summary\n",
            ),
        )
    )

    assert decision == SafetyDecision.ALLOW


def test_text_editor_create_workspace_root_requires_confirmation() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="/workspace/report.txt",
                file_text="Summary\n",
            ),
        )
    )

    assert decision == SafetyDecision.CONFIRM


def test_text_editor_create_outputs_path_escape_requires_confirmation() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="create",
                path="outputs/../uploads/input.md",
                file_text="Summary\n",
            ),
        )
    )

    assert decision == SafetyDecision.CONFIRM


def test_workspace_file_edit_requires_confirmation() -> None:
    policy = SafetyPolicy(display_width=1280, display_height=800)

    decision = policy.evaluate(
        ToolCall(
            tool_call_id="call_1",
            name="text_editor",
            text_editor=TextEditorAction(
                command="str_replace",
                path="/workspace/run_123/uploads/input.md",
                old_str="old",
                new_str="new",
            ),
        )
    )

    assert decision == SafetyDecision.CONFIRM
