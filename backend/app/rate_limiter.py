import asyncio
import time
from typing import Dict


class RateLimiter:
    """Simple in-memory token bucket rate limiter keyed by client identifier."""

    def __init__(self, rate: float, burst: int) -> None:
        if rate <= 0:
            raise ValueError("rate must be > 0")
        if burst <= 0:
            raise ValueError("burst must be > 0")
        self.rate = float(rate)
        self.capacity = float(burst)
        self._buckets: Dict[str, dict[str, float]] = {}
        self._lock = asyncio.Lock()

    async def allow(self, client_id: str) -> bool:
        now = time.monotonic()
        async with self._lock:
            bucket = self._buckets.get(client_id)
            if bucket is None:
                bucket = {"tokens": self.capacity, "timestamp": now}
                self._buckets[client_id] = bucket

            elapsed = max(0.0, now - bucket["timestamp"])
            refilled = min(self.capacity, bucket["tokens"] + elapsed * self.rate)

            if refilled < 1.0:
                bucket["tokens"] = refilled
                bucket["timestamp"] = now
                return False

            bucket["tokens"] = refilled - 1.0
            bucket["timestamp"] = now
            return True
