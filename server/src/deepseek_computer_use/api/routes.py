import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import inspect, text

from deepseek_computer_use.agent.core import AgentCore
from deepseek_computer_use.agent.events import normalize_event_payload
from deepseek_computer_use.config import settings
from deepseek_computer_use.models.deepseek import DeepSeekAdapter
from deepseek_computer_use.models.protocol import AgentStatus, ToolCall
from deepseek_computer_use.persistence.database import (
    create_app_engine,
    create_session_factory,
    create_tables,
    session_scope,
)
from deepseek_computer_use.persistence.schema import RunEventRecord, RunRecord
from deepseek_computer_use.runtime.docker_runtime import DockerRuntime
from deepseek_computer_use.runtime.mock_runtime import MockRuntime
from deepseek_computer_use.runtime.run_scoped_runtime import RunScopedRuntime
from deepseek_computer_use.safety.policy import SafetyPolicy
from deepseek_computer_use.voice.parser import VoiceIntentParser, VoiceInterpretation
from deepseek_computer_use.workspace.manager import WorkspaceManager


router = APIRouter()
workspace_manager = WorkspaceManager(settings.app_workspace_root)
runs: dict[str, "RunState"] = {}
_engine = create_app_engine(settings.app_database_url)
_session_factory = create_session_factory(_engine)


def _initialize_history_store() -> None:
    if settings.app_database_url.startswith("sqlite:///"):
        db_path = Path(settings.app_database_url.removeprefix("sqlite:///"))
        db_path.parent.mkdir(parents=True, exist_ok=True)
    create_tables(_engine)
    columns = {column["name"] for column in inspect(_engine).get_columns("runs")}
    if "final_text" not in columns:
        with _engine.begin() as connection:
            connection.execute(text("ALTER TABLE runs ADD COLUMN final_text TEXT"))


_initialize_history_store()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CreateRunRequest(BaseModel):
    task: str


class VoiceInterpretRequest(BaseModel):
    transcript: str
    language: str = ""
    current_task: str = ""
    run_status: str | None = None
    has_pending_confirmation: bool = False


class RunState(BaseModel):
    run_id: str
    task: str
    status: str
    final_text: str | None = None
    steps: int = 0
    max_steps: int = settings.app_max_steps
    model: str = settings.deepseek_model
    token_budget: int = settings.app_token_budget
    cost_budget_usd: float = settings.app_cost_budget_usd
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0
    estimated_cost_usd: float = 0.0
    created_at: str = Field(default_factory=_utc_now)
    updated_at: str = Field(default_factory=_utc_now)
    pending_confirmation: ToolCall | None = None
    pending_confirmation_summary: str | None = None
    agent_messages: list[dict[str, Any]] = Field(default_factory=list, exclude=True)
    events: list[dict[str, Any]] = Field(default_factory=list)


class RunHistoryItem(BaseModel):
    run_id: str
    task: str
    status: str
    final_text: str | None = None
    created_at: str
    updated_at: str


@router.post("/runs", response_model=RunState)
def create_run(request: CreateRunRequest) -> RunState:
    run_id = f"run_{uuid4().hex}"
    workspace_manager.create_run_workspace(run_id)
    runs[run_id] = RunState(
        run_id=run_id,
        task=request.task,
        status=AgentStatus.created.value,
        model=_select_model(request.task),
    )
    _persist_run(runs[run_id])
    _append_event(runs[run_id], "created", "Run created")
    return runs[run_id]


@router.get("/runs", response_model=list[RunHistoryItem])
def list_runs() -> list[RunHistoryItem]:
    history: dict[str, RunHistoryItem] = {}
    with session_scope(_session_factory) as session:
        records = session.query(RunRecord).order_by(RunRecord.updated_at.desc()).all()
        for record in records:
            history[record.id] = RunHistoryItem(
                run_id=record.id,
                task=record.task,
                status=record.status,
                final_text=record.final_text,
                created_at=_format_datetime(record.created_at),
                updated_at=_format_datetime(record.updated_at),
            )
    for run in runs.values():
        history[run.run_id] = _history_item_from_run(run)
    return sorted(history.values(), key=lambda item: item.updated_at, reverse=True)


@router.post("/voice/interpret", response_model=VoiceInterpretation)
def interpret_voice(request: VoiceInterpretRequest) -> VoiceInterpretation:
    parser = _build_voice_intent_parser()
    return parser.interpret(
        transcript=request.transcript,
        language=request.language or "en-US",
        current_task=request.current_task,
        run_status=request.run_status,
        has_pending_confirmation=request.has_pending_confirmation,
    )


@router.get("/runs/{run_id}", response_model=RunState)
def get_run(run_id: str) -> RunState:
    return _get_run(run_id)


@router.post("/runs/{run_id}/start", response_model=RunState)
async def start_run(run_id: str) -> RunState:
    run = _get_run(run_id)
    if not settings.deepseek_api_key:
        _append_event(run, "error", "DEEPSEEK_API_KEY is not configured")
        raise HTTPException(status_code=400, detail="DEEPSEEK_API_KEY is not configured")

    run.status = AgentStatus.running.value
    _append_event(run, "status", "Run started")
    asyncio.create_task(_run_agent_task(run))
    return run


@router.post("/runs/{run_id}/approve", response_model=RunState)
async def approve_confirmation(run_id: str) -> RunState:
    run = _get_run(run_id)
    if run.status != AgentStatus.waiting_for_confirmation.value:
        raise HTTPException(status_code=400, detail="run is not waiting for confirmation")
    if run.pending_confirmation is None or not run.agent_messages:
        raise HTTPException(status_code=400, detail="no pending confirmation")

    pending = run.pending_confirmation
    run.pending_confirmation = None
    run.pending_confirmation_summary = None
    run.status = AgentStatus.running.value
    _append_event(run, "confirmation", f"Approved {_summarize_tool_call(pending)}")
    asyncio.create_task(
        _continue_after_confirmation_task(
            run=run,
            pending=pending,
            agent_messages=run.agent_messages,
            steps=run.steps,
            prompt_tokens=run.prompt_tokens,
            completion_tokens=run.completion_tokens,
            total_tokens=run.total_tokens,
            prompt_cache_hit_tokens=run.prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=run.prompt_cache_miss_tokens,
            estimated_cost_usd=run.estimated_cost_usd,
        )
    )
    return run


@router.post("/runs/{run_id}/reject", response_model=RunState)
def reject_confirmation(run_id: str) -> RunState:
    run = _get_run(run_id)
    if run.status != AgentStatus.waiting_for_confirmation.value:
        raise HTTPException(status_code=400, detail="run is not waiting for confirmation")
    summary = run.pending_confirmation_summary or "pending action"
    run.status = AgentStatus.failed.value
    run.final_text = "confirmation rejected"
    run.pending_confirmation = None
    run.pending_confirmation_summary = None
    run.agent_messages = []
    _append_event(run, "confirmation", f"Rejected {summary}")
    return run


@router.post("/runs/{run_id}/pause", response_model=RunState)
def pause_run(run_id: str) -> RunState:
    run = _get_run(run_id)
    if run.status not in {AgentStatus.completed.value, AgentStatus.failed.value}:
        run.status = AgentStatus.paused.value
        _append_event(run, "status", "Run paused")
    return run


@router.post("/runs/{run_id}/resume", response_model=RunState)
def resume_run(run_id: str) -> RunState:
    run = _get_run(run_id)
    if run.status == AgentStatus.paused.value:
        run.status = AgentStatus.created.value
        _append_event(run, "status", "Run resumed")
    return run


@router.post("/runs/{run_id}/cancel", response_model=RunState)
def cancel_run(run_id: str) -> RunState:
    run = _get_run(run_id)
    run.status = AgentStatus.canceled.value
    _append_event(run, "status", "Run canceled")
    return run


@router.post("/runs/{run_id}/files")
async def upload_file(run_id: str, file: UploadFile = File()) -> dict[str, str | int]:
    workspace = workspace_manager.create_run_workspace(run_id)
    target = workspace.uploads_dir / Path(file.filename or "upload.bin").name
    content = await file.read()
    target.write_bytes(content)
    if run_id in runs:
        _append_event(runs[run_id], "file", f"Uploaded {target.name}")
    return {"relative_path": f"uploads/{target.name}", "size_bytes": len(content)}


@router.get("/runs/{run_id}/events")
def list_events(run_id: str) -> list[dict[str, Any]]:
    _get_run(run_id)
    with session_scope(_session_factory) as session:
        records = (
            session.query(RunEventRecord)
            .filter(RunEventRecord.run_id == run_id)
            .order_by(RunEventRecord.id.asc())
            .all()
        )
        if records:
            return [_event_record_to_response(record) for record in records]
    return _get_run(run_id).events


@router.get("/runs/{run_id}/files")
def list_files(run_id: str) -> list[dict[str, str | int]]:
    workspace = workspace_manager.create_run_workspace(run_id)
    files: list[dict[str, str | int]] = []
    for path in workspace.root.rglob("*"):
        if path.is_file():
            files.append(
                {
                    "relative_path": str(path.relative_to(workspace.root)),
                    "size_bytes": path.stat().st_size,
                }
            )
    return files


@router.get("/runs/{run_id}/files/{relative_path:path}")
def download_file(run_id: str, relative_path: str) -> FileResponse:
    workspace = workspace_manager.create_run_workspace(run_id)
    path = workspace.resolve_user_path(relative_path)
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path, filename=path.name, media_type="application/octet-stream")


def _get_run(run_id: str) -> RunState:
    run = runs.get(run_id)
    if run is None:
        run = _load_persisted_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return run


def _build_voice_intent_parser() -> VoiceIntentParser:
    return VoiceIntentParser(
        model=settings.deepseek_fast_model or settings.deepseek_model,
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
    )


def _append_event(run: RunState, kind: str, message: str | dict[str, Any]) -> None:
    run.updated_at = _utc_now()
    event = {"kind": kind, **message} if isinstance(message, dict) else {"kind": kind, "message": message}
    run.events.append(event)
    _persist_run(run)
    _persist_event(run.run_id, kind, event)


def _persist_run(run: RunState) -> None:
    with session_scope(_session_factory) as session:
        record = session.get(RunRecord, run.run_id)
        if record is None:
            record = RunRecord(id=run.run_id, task=run.task, status=run.status)
            session.add(record)
        record.task = run.task
        record.status = run.status
        record.final_text = run.final_text
        record.created_at = _parse_datetime(run.created_at)
        record.updated_at = _parse_datetime(run.updated_at)


def _persist_event(run_id: str, kind: str, event: dict[str, Any]) -> None:
    payload = {key: value for key, value in event.items() if key != "kind"}
    with session_scope(_session_factory) as session:
        if session.get(RunRecord, run_id) is None:
            return
        session.add(
            RunEventRecord(
                run_id=run_id,
                kind=kind,
                payload_json=json.dumps(payload, default=str),
            )
        )


def _event_record_to_response(record: RunEventRecord) -> dict[str, Any]:
    try:
        payload = json.loads(record.payload_json)
    except json.JSONDecodeError:
        payload = {"message": record.payload_json}
    return normalize_event_payload(
        kind=record.kind,
        payload=payload,
        event_id=record.id,
        run_id=record.run_id,
        created_at=_format_datetime(record.created_at),
    )


def _history_item_from_run(run: RunState) -> RunHistoryItem:
    return RunHistoryItem(
        run_id=run.run_id,
        task=run.task,
        status=run.status,
        final_text=run.final_text,
        created_at=run.created_at,
        updated_at=run.updated_at,
    )


def _load_persisted_run(run_id: str) -> RunState | None:
    with session_scope(_session_factory) as session:
        record = session.get(RunRecord, run_id)
        if record is None:
            return None
        return RunState(
            run_id=record.id,
            task=record.task,
            status=record.status,
            final_text=record.final_text,
            created_at=_format_datetime(record.created_at),
            updated_at=_format_datetime(record.updated_at),
        )


def _parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _format_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.isoformat()


async def _run_agent_task(run: RunState) -> None:
    result = await _build_agent(run).run(run.task)
    if run.status != AgentStatus.canceled.value:
        _apply_run_result(run, result)


async def _continue_after_confirmation_task(
    *,
    run: RunState,
    pending: ToolCall,
    agent_messages: list[dict[str, Any]],
    steps: int,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    prompt_cache_hit_tokens: int,
    prompt_cache_miss_tokens: int,
    estimated_cost_usd: float,
) -> None:
    result = await _build_agent(run).continue_after_confirmation(
        messages=agent_messages,
        pending_tool_call=pending,
        steps=steps,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        prompt_cache_hit_tokens=prompt_cache_hit_tokens,
        prompt_cache_miss_tokens=prompt_cache_miss_tokens,
        estimated_cost_usd=estimated_cost_usd,
    )
    if run.status != AgentStatus.canceled.value:
        _apply_run_result(run, result)


def _apply_run_result(run: RunState, result) -> None:
    run.status = result.status
    run.final_text = result.final_text
    run.steps = result.steps
    run.prompt_tokens = result.prompt_tokens
    run.completion_tokens = result.completion_tokens
    run.total_tokens = result.total_tokens
    run.prompt_cache_hit_tokens = result.prompt_cache_hit_tokens
    run.prompt_cache_miss_tokens = result.prompt_cache_miss_tokens
    run.estimated_cost_usd = result.estimated_cost_usd
    run.pending_confirmation = result.pending_tool_call
    run.pending_confirmation_summary = (
        _summarize_tool_call(result.pending_tool_call) if result.pending_tool_call else None
    )
    run.agent_messages = result.agent_messages or []
    _append_event(run, "status", f"Run finished with status {result.status}")
    _append_event(
        run,
        "usage",
        (
            f"{result.steps} steps, {result.total_tokens} tokens, "
            f"{result.prompt_cache_hit_tokens} cache-hit tokens, "
            f"${run.estimated_cost_usd:.4f} estimated"
        ),
    )
    if run.pending_confirmation_summary:
        _append_event(run, "confirmation", f"Approval required for {run.pending_confirmation_summary}")


def _estimate_cost_usd(*, prompt_tokens: int, completion_tokens: int) -> float:
    input_cost = prompt_tokens / 1_000_000 * settings.deepseek_input_usd_per_mtok
    output_cost = completion_tokens / 1_000_000 * settings.deepseek_output_usd_per_mtok
    return round(input_cost + output_cost, 6)


def _select_model(task: str) -> str:
    if settings.deepseek_routing == "cost_first":
        complex_terms = ("code", "debug", "analyze", "设计", "实现", "修复", "复杂")
        if any(term in task.lower() for term in complex_terms):
            return settings.deepseek_pro_model
        return settings.deepseek_fast_model
    if settings.deepseek_routing == "fast":
        return settings.deepseek_fast_model
    return settings.deepseek_pro_model or settings.deepseek_model


def _build_runtime():
    if settings.app_runtime_mode == "mock":
        return MockRuntime(width=settings.runtime_display_width, height=settings.runtime_display_height)
    return DockerRuntime(
        action_url=settings.runtime_action_url,
        width=settings.runtime_display_width,
        height=settings.runtime_display_height,
    )


def _build_agent(run: RunState) -> AgentCore:
    model = DeepSeekAdapter(
        model=run.model,
        api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        thinking=settings.deepseek_thinking,
    )
    safety = SafetyPolicy(
        display_width=settings.runtime_display_width,
        display_height=settings.runtime_display_height,
    )
    return AgentCore(
        model=model,
        runtime=RunScopedRuntime(runtime=_build_runtime(), run_id=run.run_id),
        safety=safety,
        max_steps=settings.app_max_steps,
        token_budget=settings.app_token_budget,
        cost_budget_usd=settings.app_cost_budget_usd,
        input_usd_per_mtok=settings.deepseek_input_usd_per_mtok,
        output_usd_per_mtok=settings.deepseek_output_usd_per_mtok,
        on_event=lambda kind, payload: _append_event(run, kind, payload),
    )


def _summarize_tool_call(tool_call: ToolCall) -> str:
    if tool_call.bash is not None:
        return f"bash: {tool_call.bash.command}"
    if tool_call.text_editor is not None:
        return f"text_editor {tool_call.text_editor.command}: {tool_call.text_editor.path}"
    if tool_call.computer is not None:
        return f"computer: {tool_call.computer.action}"
    return tool_call.name
