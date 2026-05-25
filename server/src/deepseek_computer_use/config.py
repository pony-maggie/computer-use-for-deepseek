from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-pro"
    deepseek_fast_model: str = "deepseek-v4-flash"
    deepseek_pro_model: str = "deepseek-v4-pro"
    deepseek_routing: str = "quality_first"
    deepseek_thinking: str = "enabled"
    app_database_url: str = "sqlite:///./data/app.db"
    app_workspace_root: Path = Path("./workspace")
    app_screenshot_root: Path = Path("./screenshots")
    app_max_steps: int = 30
    app_token_budget: int = 2_000_000
    app_cost_budget_usd: float = 0.0
    deepseek_input_usd_per_mtok: float = 0.0
    deepseek_output_usd_per_mtok: float = 0.0
    app_runtime_mode: str = "docker"
    runtime_action_url: str = "http://runtime:7070"
    runtime_display_width: int = 1440
    runtime_display_height: int = 1112
    runtime_novnc_url: str = "http://localhost:6080/vnc.html"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
