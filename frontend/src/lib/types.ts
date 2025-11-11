export type Role = "system" | "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage: Usage;
  latency_ms: number;
}

export interface ChatParams {
  temperature: number;
  top_p: number;
  seed?: number | null;
}

export interface ChatPayload {
  model: string;
  messages: { role: Role; content: string }[];
  params: Partial<ChatParams>;
}

export type StreamTokenEvent = { type: "token"; token: string };
export type StreamDoneEvent = { type: "done"; content: string; usage: Usage; latency_ms: number };
export type StreamErrorEvent = { type: "error"; message: string; details?: unknown };

export type StreamEvent = StreamTokenEvent | StreamDoneEvent | StreamErrorEvent;

export interface ModelInfo {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
}

export interface ChatConfig {
  httpUrl: string;
  wsUrl: string;
  apiKey?: string;
}

export type ChatStatus = "idle" | "streaming" | "error";

export type TransportKind = "ws" | "sse" | "none";
