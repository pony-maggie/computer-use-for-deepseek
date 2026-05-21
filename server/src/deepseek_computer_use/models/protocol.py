from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class ActionName(StrEnum):
    screenshot = "screenshot"
    browser_snapshot = "browser_snapshot"
    open_url = "open_url"
    left_click = "left_click"
    double_click = "double_click"
    right_click = "right_click"
    middle_click = "middle_click"
    mouse_move = "mouse_move"
    drag = "drag"
    type = "type"
    key = "key"
    scroll = "scroll"
    wait = "wait"
    zoom = "zoom"
    shell = "shell"
    text_edit = "text_edit"


Coordinate = tuple[int, int]


class ComputerAction(BaseModel):
    action_id: str = Field(default_factory=lambda: f"act_{uuid4().hex}")
    action: ActionName
    coordinate: Coordinate | None = None
    end_coordinate: Coordinate | None = None
    text: str | None = None
    key: str | None = None
    scroll_direction: Literal["up", "down", "left", "right"] | None = None
    scroll_amount: int | None = Field(default=None, ge=1, le=10)
    duration_ms: int | None = Field(default=None, ge=0, le=60_000)
    region: tuple[int, int, int, int] | None = None
    command: str | None = None
    path: str | None = None
    modifiers: list[Literal["shift", "ctrl", "alt", "super"]] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_shape(self) -> "ComputerAction":
        pointer_actions = {
            ActionName.left_click,
            ActionName.double_click,
            ActionName.right_click,
            ActionName.middle_click,
            ActionName.mouse_move,
        }
        if self.action in pointer_actions and self.coordinate is None:
            raise ValueError(f"{self.action} requires coordinate")
        if self.action == ActionName.drag and (
            self.coordinate is None or self.end_coordinate is None
        ):
            raise ValueError("drag requires coordinate and end_coordinate")
        if self.action == ActionName.type and not self.text:
            raise ValueError("type requires text")
        if self.action == ActionName.open_url and not self.text:
            raise ValueError("open_url requires text")
        if self.action == ActionName.key and not self.key:
            raise ValueError("key requires key")
        if self.action == ActionName.scroll and (
            self.coordinate is None
            or self.scroll_direction is None
            or self.scroll_amount is None
        ):
            raise ValueError("scroll requires coordinate, scroll_direction, and scroll_amount")
        if self.action == ActionName.wait and self.duration_ms is None:
            raise ValueError("wait requires duration_ms")
        if self.action == ActionName.zoom and self.region is None:
            raise ValueError("zoom requires region")
        return self

    @field_validator("region")
    @classmethod
    def validate_region_shape(
        cls, value: tuple[int, int, int, int] | None
    ) -> tuple[int, int, int, int] | None:
        if value is None:
            return value
        x1, y1, x2, y2 = value
        if x2 <= x1 or y2 <= y1:
            raise ValueError("zoom region must have positive width and height")
        return value

    def validate_for_display(self, *, width: int, height: int) -> None:
        points = [point for point in (self.coordinate, self.end_coordinate) if point is not None]
        for x, y in points:
            if not (0 <= x < width and 0 <= y < height):
                raise ValueError(f"coordinate ({x}, {y}) outside display bounds ({width}x{height})")
        if self.region is not None:
            x1, y1, x2, y2 = self.region
            if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
                raise ValueError(f"region {self.region} outside display bounds ({width}x{height})")


class DisplayInfo(BaseModel):
    width: int
    height: int
    scale: float = 1.0


class ScreenshotRef(BaseModel):
    mime_type: str = "image/png"
    path: str | None = None
    base64: str | None = None
    hash: str | None = None


class ObservationError(BaseModel):
    code: str
    message: str


class Observation(BaseModel):
    ok: bool
    action_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    display: DisplayInfo | None = None
    screenshot: ScreenshotRef | None = None
    text: str | None = None
    error: ObservationError | None = None

    @model_validator(mode="after")
    def validate_error_state(self) -> "Observation":
        if not self.ok and self.error is None:
            raise ValueError("failed observation requires error")
        return self


class BashAction(BaseModel):
    command: str
    restart: bool = False


class TextEditorCommand(StrEnum):
    view = "view"
    create = "create"
    str_replace = "str_replace"


class TextEditorAction(BaseModel):
    command: TextEditorCommand
    path: str
    file_text: str | None = None
    old_str: str | None = None
    new_str: str | None = None

    @model_validator(mode="after")
    def validate_command_shape(self) -> "TextEditorAction":
        if self.command == TextEditorCommand.create and self.file_text is None:
            raise ValueError("create requires file_text")
        if self.command == TextEditorCommand.str_replace and (
            self.old_str is None or self.new_str is None
        ):
            raise ValueError("str_replace requires old_str and new_str")
        return self


class ToolResult(BaseModel):
    output: str | None = None
    error: str | None = None
    base64_image: str | None = None
    image_hash: str | None = None
    perception_cache_hit: bool = False
    system: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None


class ToolCall(BaseModel):
    tool_call_id: str
    name: str
    computer: ComputerAction | None = None
    bash: BashAction | None = None
    text_editor: TextEditorAction | None = None

    @model_validator(mode="after")
    def validate_tool_payload(self) -> "ToolCall":
        if self.name not in {"computer", "bash", "text_editor"}:
            raise ValueError(f"unsupported tool call {self.name}")
        payloads = [self.computer, self.bash, self.text_editor]
        if sum(payload is not None for payload in payloads) != 1:
            raise ValueError("tool call requires exactly one payload")
        if self.name == "computer" and self.computer is None:
            raise ValueError("computer tool call requires computer payload")
        if self.name == "bash" and self.bash is None:
            raise ValueError("bash tool call requires bash payload")
        if self.name == "text_editor" and self.text_editor is None:
            raise ValueError("text_editor tool call requires text_editor payload")
        return self


class AgentStatus(StrEnum):
    created = "created"
    running = "running"
    waiting_for_confirmation = "waiting_for_confirmation"
    paused = "paused"
    completed = "completed"
    failed = "failed"
    canceled = "canceled"
