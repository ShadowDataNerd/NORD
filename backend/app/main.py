from __future__ import annotations

import logging
import logging.config
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

import orjson
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, StreamingResponse
from fastapi.websockets import WebSocketState
from pydantic import ValidationError

from app.config import Settings, get_settings
from app.deps import enforce_rate_limit, enforce_rate_limit_ws, verify_api_key, verify_api_key_ws
from app.metrics import metrics
from app.ollama_client import OllamaClient, OllamaServiceError
from app.schemas import ChatMessage, ChatRequest, ChatResponse, MetricsResponse, ModelInfo, ModelListResponse, UsageStats


class JsonFormatter(logging.Formatter):
    """Formats log records as JSON strings."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
        timestamp = f"{timestamp}.{int(record.msecs):03d}Z"
        log = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log["exc_info"] = self.formatException(record.exc_info)
        for key, value in record.__dict__.items():
            if key in {
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
            }:
                continue
            log[key] = value
        return orjson.dumps(log).decode("utf-8")


def configure_logging() -> None:
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"json": {"()": JsonFormatter}},
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "json",
                "level": "INFO",
            }
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.error": {"handlers": ["default"], "level": "INFO", "propagate": False},
            "uvicorn.access": {"handlers": ["default"], "level": "INFO", "propagate": False},
        },
        "root": {"handlers": ["default"], "level": "INFO"},
    }
    logging.config.dictConfig(logging_config)


configure_logging()
settings: Settings = get_settings()
ollama_client = OllamaClient(settings.ollama_base_url)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Jetson Chat Gateway",
    version="0.1.0",
    default_response_class=ORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await ollama_client.close()


@app.get("/healthz", tags=["system"])
async def healthz() -> Dict[str, str]:
    return {"status": "ok"}


@app.get(
    "/api/models",
    response_model=ModelListResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
async def list_models() -> ModelListResponse:
    try:
        raw_models = await ollama_client.list_models()
    except OllamaServiceError as exc:
        raise HTTPException(status_code=_map_status(exc.status_code), detail=str(exc)) from exc

    models = []
    for raw in raw_models:
        name = raw.get("name") or raw.get("model")
        if not name:
            continue
        models.append(
            ModelInfo(
                name=name,
                modified_at=raw.get("modified_at"),
                size=raw.get("size"),
                digest=raw.get("digest"),
            )
        )
    return ModelListResponse(models=models)


@app.post(
    "/api/chat",
    response_model=ChatResponse,
    dependencies=[Depends(verify_api_key), Depends(enforce_rate_limit)],
)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse | StreamingResponse:
    model_name = payload.model or settings.default_model
    messages = [message.model_dump() for message in payload.messages]
    options = _build_options(payload)
    if payload.stream:
        generator = _sse_chat_generator(model_name, messages, options)
        headers = {
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
        return StreamingResponse(generator, media_type="text/event-stream", headers=headers)

    started = time.perf_counter()
    try:
        response = await ollama_client.chat(model=model_name, messages=messages, options=options)
    except OllamaServiceError as exc:
        raise HTTPException(status_code=_map_status(exc.status_code), detail=str(exc)) from exc

    content = _extract_content(response)
    usage = UsageStats(
        prompt_tokens=int(response.get("prompt_eval_count") or 0),
        completion_tokens=int(response.get("eval_count") or 0),
    )
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
    latency_ms = int((time.perf_counter() - started) * 1000)
    metrics.record(latency_ms, usage.prompt_tokens, usage.completion_tokens)

    return ChatResponse(
        id=response.get("id") or str(uuid.uuid4()),
        model=response.get("model") or model_name,
        content=content,
        usage=usage,
        latency_ms=latency_ms,
    )


@app.get(
    "/api/metrics",
    response_model=MetricsResponse,
    dependencies=[Depends(verify_api_key)],
)
async def metrics_endpoint() -> MetricsResponse:
    snapshot = metrics.snapshot()
    return MetricsResponse(**snapshot)


@app.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    _: None = Depends(verify_api_key_ws),
    __: None = Depends(enforce_rate_limit_ws),
) -> None:
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
        except WebSocketDisconnect:
            break
        except Exception as exc:
            await _send_ws_error(websocket, f"Invalid message: {exc}")
            continue

        params = data.get("params") or {}
        merged_payload = {
            "model": data.get("model"),
            "messages": data.get("messages", []),
            "temperature": params.get("temperature", data.get("temperature")),
            "top_p": params.get("top_p", data.get("top_p")),
            "seed": params.get("seed", data.get("seed")),
            "stream": True,
        }
        try:
            chat_request = ChatRequest(**merged_payload)
        except ValidationError as exc:
            await _send_ws_error(websocket, "Invalid payload", details=exc.errors())
            continue

        await _handle_websocket_chat(websocket, chat_request)


async def _sse_chat_generator(
    model_name: str, messages: List[Dict[str, str]], options: Optional[Dict[str, Any]]
) -> AsyncGenerator[str, None]:
    started = time.perf_counter()
    collected: List[str] = []
    done_sent = False
    try:
        async for chunk in ollama_client.stream_chat(model=model_name, messages=messages, options=options):
            if chunk.get("error"):
                raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(chunk["error"]))
            token = _token_from_chunk(chunk)
            if token:
                collected.append(token)
                yield _format_sse({"type": "token", "token": token})
            if chunk.get("done"):
                done_sent = True
                usage = _usage_from_chunk(chunk)
                latency_ms = int((time.perf_counter() - started) * 1000)
                usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
                metrics.record(latency_ms, usage.prompt_tokens, usage.completion_tokens)
                done_event = {
                    "type": "done",
                    "content": "".join(collected),
                    "usage": usage.model_dump(),
                    "latency_ms": latency_ms,
                }
                yield _format_sse(done_event)
                break
    except OllamaServiceError as exc:
        raise HTTPException(status_code=_map_status(exc.status_code), detail=str(exc)) from exc
    if not done_sent:
        latency_ms = int((time.perf_counter() - started) * 1000)
        usage = UsageStats()
        metrics.record(latency_ms)
        yield _format_sse(
            {
                "type": "done",
                "content": "".join(collected),
                "usage": usage.model_dump(),
                "latency_ms": latency_ms,
            }
        )


async def _handle_websocket_chat(websocket: WebSocket, chat_request: ChatRequest) -> None:
    started = time.perf_counter()
    collected: List[str] = []
    done_sent = False
    try:
        async for chunk in ollama_client.stream_chat(
            model=chat_request.model or settings.default_model,
            messages=[message.model_dump() for message in chat_request.messages],
            options=_build_options(chat_request),
        ):
            if chunk.get("error"):
                await _send_ws_error(websocket, str(chunk.get("error")))
                return
            token = _token_from_chunk(chunk)
            if token:
                collected.append(token)
                await websocket.send_json({"type": "token", "token": token})
            if chunk.get("done"):
                usage = _usage_from_chunk(chunk)
                usage.total_tokens = usage.prompt_tokens + usage.completion_tokens
                latency_ms = int((time.perf_counter() - started) * 1000)
                metrics.record(latency_ms, usage.prompt_tokens, usage.completion_tokens)
                await websocket.send_json(
                    {
                        "type": "done",
                        "content": "".join(collected),
                        "usage": usage.model_dump(),
                        "latency_ms": latency_ms,
                    }
                )
                done_sent = True
                return
        if not done_sent:
            latency_ms = int((time.perf_counter() - started) * 1000)
            metrics.record(latency_ms)
            await websocket.send_json(
                {
                    "type": "done",
                    "content": "".join(collected),
                    "usage": UsageStats().model_dump(),
                    "latency_ms": latency_ms,
                }
            )
    except WebSocketDisconnect:
        return
    except OllamaServiceError as exc:
        await _send_ws_error(websocket, str(exc))
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.exception("WebSocket streaming error")
        await _send_ws_error(websocket, f"Unexpected error: {exc}")


def _build_options(payload: ChatRequest) -> Dict[str, Any]:
    return {
        key: value
        for key, value in {
            "temperature": payload.temperature,
            "top_p": payload.top_p,
            "seed": payload.seed,
        }.items()
        if value is not None
    }


def _token_from_chunk(chunk: Dict[str, Any]) -> str:
    if "response" in chunk and chunk["response"]:
        return str(chunk["response"])
    message = chunk.get("message") or {}
    if isinstance(message, dict):
        content = message.get("content")
        if content:
            return str(content)
    return ""


def _usage_from_chunk(chunk: Dict[str, Any]) -> UsageStats:
    return UsageStats(
        prompt_tokens=int(chunk.get("prompt_eval_count") or 0),
        completion_tokens=int(chunk.get("eval_count") or 0),
    )


def _format_sse(payload: Dict[str, Any]) -> str:
    return f"data: {orjson.dumps(payload).decode('utf-8')}\n\n"


def _map_status(status_code: int) -> int:
    if status_code >= 500:
        return status.HTTP_502_BAD_GATEWAY
    return status_code


def _extract_content(response: Dict[str, Any]) -> str:
    message = response.get("message")
    if isinstance(message, dict) and message.get("content"):
        return str(message.get("content"))
    if response.get("response"):
        return str(response["response"])
    return ""


async def _send_ws_error(websocket: WebSocket, message: str, *, details: Any | None = None) -> None:
    if websocket.application_state != WebSocketState.CONNECTED:
        return
    payload: Dict[str, Any] = {"type": "error", "message": message}
    if details is not None:
        payload["details"] = details
    await websocket.send_json(payload)
