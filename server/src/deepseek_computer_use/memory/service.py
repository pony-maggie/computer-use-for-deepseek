import re
from dataclasses import dataclass
from typing import Any


SENSITIVE_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{6,}"),
    re.compile(r"(?i)(api[_ -]?key|password|token|cookie|authorization|secret)"),
    re.compile(r"(?i)(otp|one[- ]time code|2fa|mfa)"),
)


@dataclass(frozen=True)
class MemoryCaptureInput:
    run_id: str
    task: str
    final_text: str | None
    events: list[dict[str, Any]]
    output_files: list[str]


class MemoryService:
    def __init__(self, *, max_recall: int = 5, max_capture_per_run: int = 3) -> None:
        self.max_recall = max_recall
        self.max_capture_per_run = max_capture_per_run

    def extract_candidates(self, capture: MemoryCaptureInput) -> list[dict[str, str | float]]:
        combined = " ".join(part for part in [capture.task, capture.final_text or ""] if part)
        if self._contains_sensitive_content(combined):
            return []

        candidates: list[dict[str, str | float]] = []
        normalized = combined.lower()
        if ("简体中文" in combined or "chinese" in normalized) and (
            "简短" in combined or "concise" in normalized
        ):
            candidates.append(
                {
                    "kind": "preference",
                    "summary": "User prefers concise Simplified Chinese responses.",
                    "confidence": 0.85,
                }
            )
        if "browser_snapshot" in combined and "screenshot" in combined:
            candidates.append(
                {
                    "kind": "workflow",
                    "summary": (
                        "For browser tasks, use browser_snapshot before screenshot when "
                        "DOM structure is enough."
                    ),
                    "confidence": 0.8,
                }
            )
        return candidates[: self.max_capture_per_run]

    def format_context(self, memories: list[dict[str, str]]) -> str:
        selected = memories[: self.max_recall]
        if not selected:
            return ""
        lines = ["Memory Context:"]
        for memory in selected:
            lines.append(f"- {memory['kind']}: {memory['summary']}")
        return "\n".join(lines)

    def rank_memories(self, task: str, memories: list[dict[str, Any]]) -> list[dict[str, Any]]:
        task_terms = self._terms(task)
        scored: list[tuple[float, dict[str, Any]]] = []
        for memory in memories:
            kind = str(memory.get("kind", ""))
            summary_terms = self._terms(str(memory.get("summary", "")))
            overlap = len(task_terms & summary_terms)
            if overlap == 0 and kind not in {"preference", "safety"}:
                continue
            score = (
                overlap
                + float(memory.get("confidence", 0.0))
                + float(memory.get("use_count", 0)) * 0.05
            )
            if score > 0:
                scored.append((score, memory))
        return [
            memory
            for _, memory in sorted(scored, key=lambda item: item[0], reverse=True)[
                : self.max_recall
            ]
        ]

    def _contains_sensitive_content(self, text: str) -> bool:
        return any(pattern.search(text) for pattern in SENSITIVE_PATTERNS)

    def _terms(self, text: str) -> set[str]:
        return {
            term
            for term in re.findall(r"[A-Za-z0-9_\u4e00-\u9fff]+", text.lower())
            if len(term) > 1
        }
