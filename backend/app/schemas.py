from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: Optional[str] = None
    messages: List[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    seed: Optional[int] = Field(default=None, ge=0)

    @field_validator("messages")
    @classmethod
    def validate_messages(cls, value: List[ChatMessage]) -> List[ChatMessage]:
        if not value:
            raise ValueError("messages must contain at least one item")
        return value


class UsageStats(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ChatResponse(BaseModel):
    id: str
    model: str
    content: str
    usage: UsageStats
    latency_ms: int


class ModelInfo(BaseModel):
    name: str
    modified_at: Optional[datetime] = None
    size: Optional[int] = None
    digest: Optional[str] = None


class ModelListResponse(BaseModel):
    models: List[ModelInfo]


class MetricsResponse(BaseModel):
    requests_total: int
    tokens_prompt_total: int
    tokens_completion_total: int
    latency_ms_p50: float
    latency_ms_p95: float
