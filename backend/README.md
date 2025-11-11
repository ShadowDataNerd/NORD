# Jetson Chat Gateway

FastAPI backend that exposes a modern REST + WebSocket API in front of a local Ollama instance (default `http://localhost:11434`). Designed for Jetson Orin deployments with structured JSON logging, optional API-key protection, naive in-memory rate limiting, and built-in observability metrics.

## Features
- REST `POST /api/chat` for full responses and Server-Sent Events when `stream=true`.
- `WS /ws/chat` for low-latency token streams; emits `{"type":"token"}` chunks and a final `{"type":"done"}` summary with usage + latency.
- Model discovery proxy via `GET /api/models` and health/metrics endpoints.
- Async httpx client with generous timeouts (120s total / 5s connect) and defensive error handling mapped to FastAPI `HTTPException`.
- Optional API key enforcement via `x-api-key` header plus naive token-bucket rate limiting per client IP (supports `X-Forwarded-For`).
- Structured JSON logs for both Uvicorn and application loggers, ready for ingestion by Loki/ELK.

## Requirements
- Python 3.10+
- Local Ollama server listening on `OLLAMA_BASE_URL` (defaults to `http://localhost:11434`).

## Quickstart
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
cp .env.example .env  # adjust API_KEY etc.
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Configuration (.env)
| Key | Default | Description |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL of the Ollama daemon. |
| `DEFAULT_MODEL` | `llama3` | Model used when requests omit `model`. |
| `API_KEY` | `` | Shared secret for `x-api-key`. Leave empty if `API_KEY_OPTIONAL=true`. |
| `API_KEY_OPTIONAL` | `true` | When `false`, every HTTP/Ws request must include the correct API key. |
| `RATE_LIMIT_RPS` | `3` | Token refill rate per second for the per-IP token bucket. |
| `RATE_LIMIT_BURST` | `6` | Bucket capacity (max burst). |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | Allowed frontend origins. |

## API Surface
- `GET /healthz` → `{"status":"ok"}`.
- `GET /api/models` → proxy to Ollama `/api/tags` (requires API key if enforced).
- `POST /api/chat`
  - Body: `{ "model": "llama3", "messages": [{"role":"user","content":"hi"}], "stream": false }`.
  - Response (non-stream): `{ id, model, content, usage:{...}, latency_ms }`.
  - When `stream=true` returns SSE stream where each event is `{"type":"token","token":"..."}` and final event `{"type":"done",...}`.
- `GET /api/metrics` → `{ requests_total, tokens_prompt_total, tokens_completion_total, latency_ms_p50, latency_ms_p95 }`.
- `WS /ws/chat` → client sends `{model?, messages, params?}`; server streams the same chunk schema as SSE.

## Testing
```bash
cd backend
pytest
```

## Production Notes
- Uvicorn config (`uvicorn.ini`) already sets `ws-max-size` to 16 MiB and enables proxy headers.
- For Jetson-based systemd units, prefer `EnvironmentFile=/opt/chat-backend/.env` and `ExecStart=/opt/chat-backend/.venv/bin/uvicorn --factory app.main:app`.

### Example systemd unit
```ini
[Unit]
Description=Jetson Chat Gateway
After=network.target

[Service]
WorkingDirectory=/opt/chat-backend/backend
EnvironmentFile=/opt/chat-backend/backend/.env
ExecStart=/opt/chat-backend/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
User=jetson

[Install]
WantedBy=multi-user.target
```

## Smoke Tests
With the server running on `localhost:8000`:
```bash
curl http://localhost:8000/healthz
curl http://localhost:8000/api/models
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"llama3","messages":[{"role":"user","content":"Hello!"}]}'
wscat -c ws://localhost:8000/ws/chat
```
