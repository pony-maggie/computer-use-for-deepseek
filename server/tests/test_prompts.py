from deepseek_computer_use.agent.prompts import SYSTEM_PROMPT


def test_browser_prompt_avoids_unconditional_screenshot_verification() -> None:
    assert "After important actions, verify the outcome with a screenshot." not in SYSTEM_PROMPT
    assert "For browser and DOM tasks, verify with browser_snapshot before screenshot." in SYSTEM_PROMPT


def test_prompt_requires_extraction_completeness_check() -> None:
    assert (
        "For extraction or listing tasks, compare the final answer against the observed source"
        in SYSTEM_PROMPT
    )
