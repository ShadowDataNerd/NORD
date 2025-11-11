from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ollama_base_url: str = Field(
        "http://localhost:11434", validation_alias="OLLAMA_BASE_URL", description="Base URL for the Ollama daemon"
    )
    default_model: str = Field(
        "llama3", validation_alias="DEFAULT_MODEL", description="Default Ollama model to use when none is provided"
    )
    api_key: str = Field("", validation_alias="API_KEY", description="Static API key for inbound requests")
    api_key_optional: bool = Field(True, validation_alias="API_KEY_OPTIONAL", description="Toggle API key enforcement")
    rate_limit_rps: float = Field(3.0, validation_alias="RATE_LIMIT_RPS", description="Token refill rate per second")
    rate_limit_burst: int = Field(6, validation_alias="RATE_LIMIT_BURST", description="Maximum burst size for rate limiter")
    cors_origins: List[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"],
        validation_alias="CORS_ORIGINS",
        description="Allowed CORS origins",
    )

    @field_validator("cors_origins", mode="before")
    @staticmethod
    def _parse_origins(value: List[str] | str) -> List[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                # JSON-style list
                try:
                    import json

                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        return [str(item) for item in parsed]
                except json.JSONDecodeError:
                    pass
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return ["http://localhost:5173", "http://localhost:3000"]


@lru_cache(maxsize=1)
def _load_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def get_settings() -> Settings:
    """Return cached settings instance."""

    return _load_settings()
