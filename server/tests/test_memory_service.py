from sqlalchemy import create_engine

from deepseek_computer_use.persistence.database import (
    create_session_factory,
    create_tables,
    session_scope,
)
from deepseek_computer_use.persistence.repositories import MemoryRepository
from deepseek_computer_use.memory.service import MemoryCaptureInput, MemoryService


def test_memory_repository_persists_and_lists_records() -> None:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    create_tables(engine)
    factory = create_session_factory(engine)

    with session_scope(factory) as session:
        repo = MemoryRepository(session)
        record = repo.add_memory(
            kind="preference",
            summary="User prefers concise Simplified Chinese summaries.",
            source_run_id="run_123",
            confidence=0.9,
        )
        memory_id = record.id

    with session_scope(factory) as session:
        repo = MemoryRepository(session)
        records = repo.list_memories()

    assert len(records) == 1
    assert records[0].id == memory_id
    assert records[0].kind == "preference"
    assert records[0].summary == "User prefers concise Simplified Chinese summaries."
    assert records[0].source_run_id == "run_123"
    assert records[0].confidence == 0.9
    assert records[0].use_count == 0


def test_memory_service_rejects_sensitive_content() -> None:
    service = MemoryService()

    captured = service.extract_candidates(
        MemoryCaptureInput(
            run_id="run_secret",
            task="Use API key sk-live-123 to log in",
            final_text="The token is sk-live-123.",
            events=[],
            output_files=[],
        )
    )

    assert captured == []


def test_memory_service_extracts_high_signal_preferences() -> None:
    service = MemoryService()

    captured = service.extract_candidates(
        MemoryCaptureInput(
            run_id="run_language",
            task="以后都用简体中文简短回答",
            final_text="好的，以后我会用简体中文简短回答。",
            events=[],
            output_files=[],
        )
    )

    assert captured == [
        {
            "kind": "preference",
            "summary": "User prefers concise Simplified Chinese responses.",
            "confidence": 0.85,
        }
    ]


def test_memory_service_formats_hidden_context() -> None:
    service = MemoryService(max_recall=2)
    context = service.format_context(
        [
            {"kind": "preference", "summary": "User prefers concise Simplified Chinese responses."},
            {"kind": "workflow", "summary": "For browser tasks, use browser_snapshot before screenshot."},
        ]
    )

    assert context == (
        "Memory Context:\n"
        "- preference: User prefers concise Simplified Chinese responses.\n"
        "- workflow: For browser tasks, use browser_snapshot before screenshot."
    )


def test_memory_service_does_not_rank_unrelated_facts_by_confidence_only() -> None:
    service = MemoryService(max_recall=5)

    ranked = service.rank_memories(
        "summarize a spreadsheet",
        [
            {
                "id": 1,
                "kind": "fact",
                "summary": "The previous browser task visited example.com.",
                "confidence": 0.95,
                "use_count": 3,
            },
            {
                "id": 2,
                "kind": "preference",
                "summary": "User prefers concise Simplified Chinese responses.",
                "confidence": 0.85,
                "use_count": 0,
            },
            {
                "id": 3,
                "kind": "workflow",
                "summary": "For spreadsheet tasks, save generated files under outputs/.",
                "confidence": 0.8,
                "use_count": 1,
            },
        ],
    )

    assert [memory["id"] for memory in ranked] == [3, 2]
