from __future__ import annotations

import math
import threading
from collections import deque
from typing import Deque, Dict


class MetricsCollector:
    """Tracks basic request/latency/token metrics for observability."""

    def __init__(self, window_size: int = 512) -> None:
        self._lock = threading.Lock()
        self._latencies: Deque[float] = deque(maxlen=window_size)
        self._requests_total = 0
        self._prompt_tokens = 0
        self._completion_tokens = 0

    def record(self, latency_ms: float, prompt_tokens: int = 0, completion_tokens: int = 0) -> None:
        with self._lock:
            self._requests_total += 1
            self._prompt_tokens += max(0, prompt_tokens)
            self._completion_tokens += max(0, completion_tokens)
            self._latencies.append(max(0.0, float(latency_ms)))

    def snapshot(self) -> Dict[str, float | int]:
        with self._lock:
            latencies = list(self._latencies)
            requests = self._requests_total
            prompt = self._prompt_tokens
            completion = self._completion_tokens

        return {
            "requests_total": requests,
            "tokens_prompt_total": prompt,
            "tokens_completion_total": completion,
            "latency_ms_p50": _percentile(latencies, 0.5),
            "latency_ms_p95": _percentile(latencies, 0.95),
        }


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * percentile
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return ordered[int(k)]
    return ordered[f] * (c - k) + ordered[c] * (k - f)


metrics = MetricsCollector()
