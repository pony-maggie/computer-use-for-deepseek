import json
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from deepseek_computer_use.models.protocol import AgentStatus
from deepseek_computer_use.persistence.schema import (
    MemoryRecord,
    RunEventRecord,
    RunRecord,
    WorkspaceFileRecord,
)


@dataclass(frozen=True)
class RunSummary:
    id: str
    task: str
    status: str
    final_text: str | None


class RunRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_run(self, *, run_id: str, task: str) -> RunRecord:
        record = RunRecord(id=run_id, task=task, status=AgentStatus.created.value)
        self.session.add(record)
        self.session.flush()
        return record

    def get_run(self, run_id: str) -> RunRecord | None:
        return self.session.get(RunRecord, run_id)

    def set_status(self, run_id: str, status: AgentStatus) -> None:
        record = self.session.get(RunRecord, run_id)
        if record is None:
            raise ValueError(f"run {run_id} not found")
        record.status = status.value

    def list_runs(self) -> list[RunSummary]:
        rows = self.session.query(RunRecord).order_by(RunRecord.created_at.desc()).all()
        return [
            RunSummary(id=row.id, task=row.task, status=row.status, final_text=row.final_text)
            for row in rows
        ]

    def append_event(self, run_id: str, kind: str, payload: dict[str, object]) -> None:
        self.session.add(
            RunEventRecord(run_id=run_id, kind=kind, payload_json=json.dumps(payload, default=str))
        )

    def add_workspace_file(
        self, *, run_id: str, relative_path: str, role: str, size_bytes: int
    ) -> None:
        self.session.add(
            WorkspaceFileRecord(
                run_id=run_id,
                relative_path=relative_path,
                role=role,
                size_bytes=size_bytes,
            )
        )


class MemoryRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def add_memory(
        self,
        *,
        kind: str,
        summary: str,
        source_run_id: str | None,
        confidence: float,
    ) -> MemoryRecord:
        record = MemoryRecord(
            kind=kind,
            summary=summary,
            source_run_id=source_run_id,
            confidence=confidence,
        )
        self.session.add(record)
        self.session.flush()
        return record

    def list_memories(self) -> list[MemoryRecord]:
        return self.session.query(MemoryRecord).order_by(MemoryRecord.updated_at.desc()).all()

    def mark_used(self, memory_ids: list[int]) -> None:
        if not memory_ids:
            return
        now = datetime.now(UTC)
        records = self.session.query(MemoryRecord).filter(MemoryRecord.id.in_(memory_ids)).all()
        for record in records:
            record.use_count += 1
            record.last_used_at = now
            record.updated_at = now
