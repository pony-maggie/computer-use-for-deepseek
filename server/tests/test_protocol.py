import pytest
from pydantic import ValidationError

from deepseek_computer_use.models.protocol import (
    ComputerAction,
    Observation,
    TextEditorAction,
    ToolResult,
)


def test_left_click_requires_coordinate() -> None:
    action = ComputerAction(action="left_click", coordinate=(10, 20))

    assert action.action == "left_click"
    assert action.coordinate == (10, 20)


def test_coordinate_bounds_are_validated_by_display_size() -> None:
    action = ComputerAction(action="left_click", coordinate=(1280, 20))

    with pytest.raises(ValueError, match="outside display bounds"):
        action.validate_for_display(width=1280, height=800)


def test_type_requires_text() -> None:
    with pytest.raises(ValidationError):
        ComputerAction(action="type")


def test_open_url_requires_text() -> None:
    with pytest.raises(ValidationError):
        ComputerAction(action="open_url")


def test_open_url_accepts_text_url() -> None:
    action = ComputerAction(action="open_url", text="example.com")

    assert action.action == "open_url"
    assert action.text == "example.com"


def test_observation_failed_requires_error() -> None:
    with pytest.raises(ValidationError):
        Observation(ok=False, action_id="act_1")


def test_text_editor_create_requires_file_text() -> None:
    with pytest.raises(ValidationError):
        TextEditorAction(command="create", path="report.md")


def test_tool_result_ok_reflects_error_state() -> None:
    assert ToolResult(output="done").ok is True
    assert ToolResult(error="failed").ok is False


def test_tool_result_carries_image_cache_metadata() -> None:
    result = ToolResult(
        output="screenshot",
        base64_image="aW1hZ2U=",
        image_hash="sha256:image",
        perception_cache_hit=True,
    )

    assert result.image_hash == "sha256:image"
    assert result.perception_cache_hit is True
