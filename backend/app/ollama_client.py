from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx


class OllamaServiceError(Exception):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class OllamaClient:
    """Thin async wrapper around the Ollama HTTP API."""

    def __init__(self, base_url: str) -> None:
        timeout = httpx.Timeout(timeout=120.0, connect=5.0, read=120.0, write=60.0)
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            timeout=timeout,
            headers={"Accept": "application/json"},
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def list_models(self) -> List[Dict[str, Any]]:
        try:
            response = await self._client.get("/api/tags")
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", [])
            if isinstance(models, list):
                return models
            return []
        except httpx.HTTPStatusError as exc:
            raise OllamaServiceError(_response_message(exc.response), status_code=exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise OllamaServiceError(f"Unable to reach Ollama: {exc}") from exc

    async def chat(
        self,
        *,
        model: str,
        messages: List[Dict[str, str]],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = self._build_payload(model=model, messages=messages, stream=False, options=options)
        try:
            response = await self._client.post("/api/chat", json=payload)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            raise OllamaServiceError(_response_message(exc.response), status_code=exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise OllamaServiceError(f"Unable to reach Ollama: {exc}") from exc

    async def stream_chat(
        self,
        *,
        model: str,
        messages: List[Dict[str, str]],
        options: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        payload = self._build_payload(model=model, messages=messages, stream=True, options=options)
        try:
            async with self._client.stream("POST", "/api/chat", json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        continue
        except httpx.HTTPStatusError as exc:
            raise OllamaServiceError(_response_message(exc.response), status_code=exc.response.status_code) from exc
        except httpx.RequestError as exc:
            raise OllamaServiceError(f"Unable to reach Ollama: {exc}") from exc

    @staticmethod
    def _build_payload(
        *,
        model: str,
        messages: List[Dict[str, str]],
        stream: bool,
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        payload = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }
        filtered_options = {k: v for k, v in (options or {}).items() if v is not None}
        if filtered_options:
            payload["options"] = filtered_options
        return payload


def _response_message(response: httpx.Response) -> str:
    try:
        payload = response.json()
        if isinstance(payload, dict) and "error" in payload:
            return str(payload["error"])
    except (json.JSONDecodeError, ValueError):
        pass
    return f"Ollama responded with status {response.status_code}"
