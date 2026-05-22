from __future__ import annotations

import json
import re
from typing import Any, Literal

from openai import OpenAI
from pydantic import BaseModel, Field, field_validator, model_validator

VoiceActionName = Literal[
    "create_run",
    "start_run",
    "pause_run",
    "resume_run",
    "cancel_run",
    "clear_input",
]

_allowed_actions: tuple[VoiceActionName, ...] = (
    "create_run",
    "start_run",
    "pause_run",
    "resume_run",
    "cancel_run",
    "clear_input",
)

_approval_phrases = (
    "批准",
    "同意",
    "reject",
    "reject confirmation",
    "拒绝",
    "approve",
    "approve confirmation",
)

_command_phrases: tuple[tuple[str, VoiceActionName], ...] = (
    ("创建任务", "create_run"),
    ("创建 run", "create_run"),
    ("create run", "create_run"),
    ("开始运行", "start_run"),
    ("启动任务", "start_run"),
    ("start run", "start_run"),
    ("暂停", "pause_run"),
    ("pause", "pause_run"),
    ("继续运行", "resume_run"),
    ("继续", "resume_run"),
    ("resume", "resume_run"),
    ("取消任务", "cancel_run"),
    ("取消", "cancel_run"),
    ("cancel", "cancel_run"),
    ("清空输入", "clear_input"),
    ("清空", "clear_input"),
    ("clear input", "clear_input"),
)


class VoiceInterpretation(BaseModel):
    task_text_delta: str = ""
    actions: list[VoiceActionName] = Field(default_factory=list)
    manual_confirmation_required: bool = False
    message: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_cache_hit_tokens: int = 0
    prompt_cache_miss_tokens: int = 0

    @field_validator("task_text_delta")
    @classmethod
    def _strip_task_text_delta(cls, value: str) -> str:
        return value.strip()

    @field_validator("actions")
    @classmethod
    def _dedupe_actions(cls, value: list[str]) -> list[str]:
        deduped: list[str] = []
        for action in value:
            if action in _allowed_actions and action not in deduped:
                deduped.append(action)
        return deduped

    @model_validator(mode="after")
    def _normalize_confirmation(self) -> "VoiceInterpretation":
        if self.manual_confirmation_required:
            self.actions = []
        if any(action not in _allowed_actions for action in self.actions):
            self.actions = [action for action in self.actions if action in _allowed_actions]
        return self


class VoiceIntentParser:
    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str,
        client: OpenAI | None = None,
    ) -> None:
        self.model = model
        self.client = client if client is not None else (OpenAI(api_key=api_key, base_url=base_url) if api_key else None)

    def interpret(
        self,
        *,
        transcript: str,
        language: str,
        current_task: str,
        run_status: str | None,
        has_pending_confirmation: bool,
    ) -> VoiceInterpretation:
        transcript = transcript.strip()
        if not transcript:
            return VoiceInterpretation()

        if self.client is None:
            return self._fallback_interpret(
                transcript=transcript,
                language=language,
                current_task=current_task,
                run_status=run_status,
                has_pending_confirmation=has_pending_confirmation,
            )

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0,
            messages=self._build_messages(
                transcript=transcript,
                language=language,
                current_task=current_task,
                run_status=run_status,
                has_pending_confirmation=has_pending_confirmation,
            ),
        )
        return self._parse_response(response)

    def _build_messages(
        self,
        *,
        transcript: str,
        language: str,
        current_task: str,
        run_status: str | None,
        has_pending_confirmation: bool,
    ) -> list[dict[str, str]]:
        system_prompt = (
            "You convert speech transcripts into structured UI intent for Computer Use for DeepSeek. "
            "Return strict JSON only with keys task_text_delta, actions, manual_confirmation_required, and message. "
            "Allowed actions are create_run, start_run, pause_run, resume_run, cancel_run, and clear_input. "
            "Never emit approve or reject actions. If the user asks to approve or reject a confirmation, set "
            "manual_confirmation_required to true and leave actions empty. If the transcript mixes task text with a "
            "start command and no run exists, include both create_run and start_run in that order. If the transcript "
            "contains only task content, return it in task_text_delta and leave actions empty. If the transcript asks "
            "to clear the task input, return clear_input and an empty task_text_delta."
        )
        user_prompt = (
            f"language={language}\n"
            f"current_task={current_task}\n"
            f"run_status={run_status}\n"
            f"has_pending_confirmation={has_pending_confirmation}\n"
            f"transcript={transcript}"
        )
        return [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

    def _parse_response(self, response: Any) -> VoiceInterpretation:
        message = response.choices[0].message
        content = getattr(message, "content", "") or ""
        usage = getattr(response, "usage", None)
        prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
        prompt_cache_hit_tokens = int(getattr(usage, "prompt_cache_hit_tokens", 0) or 0)
        prompt_cache_miss_tokens = int(getattr(usage, "prompt_cache_miss_tokens", 0) or 0)

        try:
            payload = self._extract_json_payload(content)
            data = json.loads(payload)
        except (ValueError, json.JSONDecodeError):
            return self._fallback_interpret(
                transcript=content,
                language="en-US",
                current_task="",
                run_status=None,
                has_pending_confirmation=False,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            )

        interpretation = VoiceInterpretation(
            task_text_delta=str(data.get("task_text_delta", "") or "").strip(),
            actions=list(data.get("actions") or []),
            manual_confirmation_required=bool(data.get("manual_confirmation_required", False)),
            message=(str(data.get("message")).strip() if data.get("message") else None),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
        )
        if self._contains_approval_request(interpretation.message or content):
            interpretation.manual_confirmation_required = True
            interpretation.actions = []
        return interpretation

    def _fallback_interpret(
        self,
        *,
        transcript: str,
        language: str,
        current_task: str,
        run_status: str | None,
        has_pending_confirmation: bool,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        prompt_cache_hit_tokens: int = 0,
        prompt_cache_miss_tokens: int = 0,
    ) -> VoiceInterpretation:
        normalized = self._normalize_text(transcript)
        if self._contains_approval_request(normalized):
            return VoiceInterpretation(
                manual_confirmation_required=True,
                message="Please approve or reject pending confirmations manually.",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            )

        action_positions = [
            (normalized.find(phrase), action)
            for phrase, action in _command_phrases
            if normalized.find(phrase) != -1
        ]
        action_positions.sort(key=lambda item: item[0])
        actions = [action for _, action in action_positions]
        task_text_delta = self._strip_command_phrases(transcript)
        if actions and "clear_input" in actions:
            task_text_delta = ""
        if "start_run" in actions and "create_run" not in actions and not current_task.strip() and not transcript.strip().startswith("start"):
            if run_status in (None, "", "idle"):
                actions = ["create_run", "start_run"]
        if "start_run" in actions and not current_task.strip() and not task_text_delta:
            if run_status in (None, "", "idle"):
                actions = ["start_run"]
        if has_pending_confirmation and self._contains_approval_request(normalized):
            return VoiceInterpretation(
                manual_confirmation_required=True,
                message="Please approve or reject pending confirmations manually.",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                prompt_cache_hit_tokens=prompt_cache_hit_tokens,
                prompt_cache_miss_tokens=prompt_cache_miss_tokens,
            )
        return VoiceInterpretation(
            task_text_delta=task_text_delta,
            actions=actions,
            manual_confirmation_required=False,
            message=None,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            prompt_cache_hit_tokens=prompt_cache_hit_tokens,
            prompt_cache_miss_tokens=prompt_cache_miss_tokens,
        )

    def _extract_json_payload(self, content: str) -> str:
        text = content.strip()
        if text.startswith("```"):
          lines = [line for line in text.splitlines() if not line.startswith("```")]
          text = "\n".join(lines).strip()
        if text.startswith("{") and text.endswith("}"):
            return text
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match is None:
            raise ValueError("voice parser returned no JSON payload")
        return match.group(0)

    def _strip_command_phrases(self, transcript: str) -> str:
        text = transcript
        for phrase, _ in _command_phrases:
            text = text.replace(phrase, " ")
        text = re.sub(r"[，,。.!！？?;；:】【：\-—]+", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _contains_approval_request(self, text: str) -> bool:
        normalized = self._normalize_text(text)
        return any(phrase in normalized for phrase in _approval_phrases)

    def _normalize_text(self, text: str) -> str:
        normalized = text.strip().lower()
        normalized = re.sub(r"[，,。.!！？?;；:】【：\-—]+", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized
