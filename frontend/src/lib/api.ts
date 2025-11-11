import type { ChatPayload, ChatResponse, ChatConfig, ModelInfo, StreamEvent } from "./types";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json"
};

const ensureHttpBase = (url: string) => url.replace(/\/$/, "");

const buildBody = (payload: ChatPayload, stream: boolean) => {
  const body: Record<string, unknown> = {
    model: payload.model,
    messages: payload.messages,
    stream
  };
  if (payload.params.temperature !== undefined) body.temperature = payload.params.temperature;
  if (payload.params.top_p !== undefined) body.top_p = payload.params.top_p;
  if (payload.params.seed !== undefined && payload.params.seed !== null) body.seed = payload.params.seed;
  return body;
};

const withApiKey = (apiKey?: string) => (apiKey ? { "x-api-key": apiKey } : {});

export async function getModels(config: ChatConfig): Promise<ModelInfo[]> {
  const base = ensureHttpBase(config.httpUrl);
  const response = await fetch(`${base}/api/models`, {
    headers: {
      ...DEFAULT_HEADERS,
      ...withApiKey(config.apiKey)
    }
  });
  if (!response.ok) {
    throw new Error(`Models request failed (${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data.models) ? data.models : [];
}

export async function postChatOnce(payload: ChatPayload, config: ChatConfig): Promise<ChatResponse> {
  const base = ensureHttpBase(config.httpUrl);
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      ...withApiKey(config.apiKey)
    },
    body: JSON.stringify(buildBody(payload, false))
  });
  if (!response.ok) {
    throw new Error(`Chat request failed (${response.status})`);
  }
  return (await response.json()) as ChatResponse;
}

export async function streamWithSse(
  payload: ChatPayload,
  config: ChatConfig,
  handlers: { onEvent: (event: StreamEvent) => void },
  signal?: AbortSignal
): Promise<void> {
  const base = ensureHttpBase(config.httpUrl);
  const url = new URL(`${base}/api/chat`);
  url.searchParams.set("stream", "true");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      ...DEFAULT_HEADERS,
      ...withApiKey(config.apiKey)
    },
    body: JSON.stringify(buildBody(payload, true)),
    signal
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split("\n\n");
    buffer = segments.pop() ?? "";
    for (const segment of segments) {
      const line = segment.trim();
      if (!line.startsWith("data:")) continue;
      const payloadStr = line.slice(5).trim();
      if (!payloadStr) continue;
      try {
        const event = JSON.parse(payloadStr) as StreamEvent;
        handlers.onEvent(event);
      } catch (error) {
        console.warn("Unable to parse SSE payload", error);
      }
    }
  }
}
