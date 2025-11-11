from __future__ import annotations

import secrets
from functools import lru_cache

from fastapi import Depends, HTTPException, Request, WebSocket, WebSocketException, status

from app.config import Settings, get_settings
from app.rate_limiter import RateLimiter


def _client_identifier_from_headers(headers, fallback: str | None) -> str:
    forwarded_for = headers.get("x-forwarded-for") if hasattr(headers, "get") else None
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if fallback:
        return fallback
    return "anonymous"


@lru_cache(maxsize=1)
def get_rate_limiter() -> RateLimiter:
    settings = get_settings()
    return RateLimiter(settings.rate_limit_rps, settings.rate_limit_burst)


async def enforce_rate_limit(request: Request, limiter: RateLimiter = Depends(get_rate_limiter)) -> None:
    client_id = _client_identifier_from_headers(request.headers, request.client.host if request.client else None)
    allowed = await limiter.allow(client_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")


async def enforce_rate_limit_ws(websocket: WebSocket, limiter: RateLimiter = Depends(get_rate_limiter)) -> None:
    client = websocket.client.host if websocket.client else None  # type: ignore[optional-member]
    client_id = _client_identifier_from_headers(websocket.headers, client)
    allowed = await limiter.allow(client_id)
    if not allowed:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Rate limit exceeded")


def _should_enforce(settings: Settings) -> bool:
    return not settings.api_key_optional


def _assert_key_configured(settings: Settings) -> str:
    if not settings.api_key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="API key not configured")
    return settings.api_key


async def verify_api_key(request: Request, settings: Settings = Depends(get_settings)) -> None:
    if not _should_enforce(settings):
        return
    expected = _assert_key_configured(settings)
    provided = request.headers.get("x-api-key")
    if not provided or not secrets.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


async def verify_api_key_ws(websocket: WebSocket, settings: Settings = Depends(get_settings)) -> None:
    if not _should_enforce(settings):
        return
    expected = settings.api_key
    if not expected:
        raise WebSocketException(code=status.WS_1011_INTERNAL_ERROR, reason="API key not configured")
    provided = websocket.headers.get("x-api-key")
    if not provided or not secrets.compare_digest(provided, expected):
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid API key")
