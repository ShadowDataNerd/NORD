import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import toast from "react-hot-toast";
import { streamWithSse } from "@/lib/api";
import { ChatWebSocket, type WsStatus } from "@/lib/ws";
import type {
  ChatConfig,
  ChatParams,
  ChatPayload,
  ChatStatus,
  Message,
  StreamDoneEvent,
  StreamEvent,
  StreamTokenEvent,
  TransportKind,
  Usage
} from "@/lib/types";

const HISTORY_KEY = "jetson-chat-history-v1";
const DEFAULT_MODEL = "llama3";
const DEFAULT_PARAMS: ChatParams = {
  temperature: 0.7,
  top_p: 0.95,
  seed: null
};

interface ChatState {
  messages: Message[];
  status: ChatStatus;
  error?: string;
  model: string;
  params: ChatParams;
  activeRequestId?: string;
  activeAssistantId?: string;
  usage?: Usage;
  latencyMs?: number;
  tokensPerSecond?: number;
  transport: TransportKind;
}

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const createMessage = (role: Message["role"], content: string): Message => ({
  id: createId(),
  role,
  content,
  createdAt: Date.now()
});

const loadHistory = (): Message[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Message[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

const persistHistory = (messages: Message[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  } catch (error) {
    console.warn("Unable to persist chat history", error);
  }
};

const initialState = (): ChatState => ({
  messages: typeof window !== "undefined" ? loadHistory() : [],
  status: "idle",
  model: DEFAULT_MODEL,
  params: DEFAULT_PARAMS,
  transport: "none"
});

type ChatAction =
  | { type: "SEND"; user: Message; assistant: Message; requestId: string; assistantId: string; transport: TransportKind }
  | { type: "TOKEN"; assistantId: string; token: string }
  | { type: "DONE"; assistantId: string; content: string; usage: Usage; latency: number }
  | { type: "ERROR"; message: string }
  | { type: "ABORT" }
  | { type: "CLEAR" }
  | { type: "SET_MODEL"; model: string }
  | { type: "SET_PARAMS"; params: Partial<ChatParams> }
  | { type: "SET_MESSAGES"; messages: Message[] };

const reducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "SEND":
      return {
        ...state,
        messages: [...state.messages, action.user, action.assistant],
        status: "streaming",
        error: undefined,
        activeRequestId: action.requestId,
        activeAssistantId: action.assistantId,
        usage: undefined,
        latencyMs: undefined,
        tokensPerSecond: undefined,
        transport: action.transport
      };
    case "TOKEN":
      if (state.activeAssistantId !== action.assistantId) return state;
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.assistantId ? { ...msg, content: msg.content + action.token } : msg
        )
      };
    case "DONE":
      if (state.activeAssistantId !== action.assistantId) return state;
      return {
        ...state,
        messages: state.messages.map((msg) => (msg.id === action.assistantId ? { ...msg, content: action.content } : msg)),
        status: "idle",
        usage: action.usage,
        latencyMs: action.latency,
        tokensPerSecond:
          action.usage.completion_tokens && action.latency > 0
            ? action.usage.completion_tokens / (action.latency / 1000)
            : undefined,
        activeAssistantId: undefined,
        activeRequestId: undefined,
        transport: "none"
      };
    case "ERROR":
      return {
        ...state,
        status: "error",
        error: action.message,
        activeAssistantId: undefined,
        activeRequestId: undefined,
        transport: "none"
      };
    case "ABORT":
      return {
        ...state,
        status: "idle",
        activeAssistantId: undefined,
        activeRequestId: undefined,
        transport: "none"
      };
    case "CLEAR":
      return {
        ...state,
        messages: [],
        status: "idle",
        usage: undefined,
        latencyMs: undefined,
        tokensPerSecond: undefined
      };
    case "SET_MESSAGES":
      return {
        ...state,
        messages: action.messages,
        status: "idle",
        usage: undefined,
        latencyMs: undefined,
        tokensPerSecond: undefined
      };
    case "SET_MODEL":
      return {
        ...state,
        model: action.model
      };
    case "SET_PARAMS":
      return {
        ...state,
        params: { ...state.params, ...action.params }
      };
    default:
      return state;
  }
};

export const useChat = (config: ChatConfig) => {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const abortRef = useRef<AbortController | null>(null);
  const wsRef = useRef<ChatWebSocket | null>(null);
  const activeRef = useRef<{ requestId: string; assistantId: string } | null>(null);
  const transportRef = useRef<TransportKind>("none");

  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      if (!activeRef.current) return;
      if (event.type === "token") {
        dispatch({ type: "TOKEN", assistantId: activeRef.current.assistantId, token: (event as StreamTokenEvent).token });
      } else if (event.type === "done") {
        const done = event as StreamDoneEvent;
        dispatch({
          type: "DONE",
          assistantId: activeRef.current.assistantId,
          content: done.content,
          usage: done.usage,
          latency: done.latency_ms
        });
        activeRef.current = null;
      } else if (event.type === "error") {
        dispatch({ type: "ERROR", message: event.message });
        toast.error(event.message || "Streaming error");
        activeRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    persistHistory(state.messages);
  }, [state.messages]);

  useEffect(() => {
    wsRef.current?.destroy();
    const ws = new ChatWebSocket({
      url: config.wsUrl,
      apiKey: config.apiKey,
      onStatusChange: setWsStatus,
      onEvent: (event) => {
        handleStreamEvent(event);
      }
    });
    wsRef.current = ws;
    return () => ws.destroy();
  }, [config.wsUrl, config.apiKey, handleStreamEvent]);

  useEffect(() => {
    transportRef.current = state.transport;
  }, [state.transport]);

  const sendPrompt = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || state.status === "streaming") return;
      const user = createMessage("user", content);
      const assistant = createMessage("assistant", "");
      const requestId = user.id;
      const assistantId = assistant.id;
      const messages = [...state.messages, user].map((msg) => ({ role: msg.role, content: msg.content }));
      const payload: ChatPayload = {
        model: state.model || DEFAULT_MODEL,
        messages,
        params: { ...state.params }
      };
      const useWs = wsRef.current?.send({
        model: payload.model,
        messages: payload.messages,
        params: payload.params
      });
      const transport: TransportKind = useWs ? "ws" : "sse";
      activeRef.current = { requestId, assistantId };
      transportRef.current = transport;
      dispatch({ type: "SEND", user, assistant, requestId, assistantId, transport });
      if (!useWs) {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          await streamWithSse(payload, config, { onEvent: handleStreamEvent }, controller.signal);
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            dispatch({ type: "ABORT" });
          } else {
            const message = (error as Error).message || "SSE error";
            dispatch({ type: "ERROR", message });
            toast.error(message);
          }
        } finally {
          abortRef.current = null;
        }
      }
    },
    [config, handleStreamEvent, state.messages, state.model, state.params, state.status]
  );

  const abort = useCallback(() => {
    if (state.status !== "streaming") return;
    if (transportRef.current === "ws") {
      wsRef.current?.abortStream();
    } else if (transportRef.current === "sse") {
      abortRef.current?.abort();
    }
    activeRef.current = null;
    dispatch({ type: "ABORT" });
  }, [state.status]);

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
    activeRef.current = null;
    persistHistory([]);
  }, []);

  const setModel = useCallback((model: string) => {
    dispatch({ type: "SET_MODEL", model });
  }, []);

  const setParams = useCallback((params: Partial<ChatParams>) => {
    dispatch({ type: "SET_PARAMS", params });
  }, []);

  const importHistory = useCallback((messages: Message[]) => {
    dispatch({ type: "SET_MESSAGES", messages });
    persistHistory(messages);
  }, []);

  return {
    ...state,
    wsStatus,
    sendPrompt,
    abort,
    clear,
    setModel,
    setParams,
    importHistory
  };
};
