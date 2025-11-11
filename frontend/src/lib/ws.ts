import type { StreamEvent } from "./types";

export type WsStatus = "connecting" | "connected" | "disconnected";

interface ChatWsOptions {
  url: string;
  apiKey?: string;
  onEvent: (event: StreamEvent) => void;
  onStatusChange?: (status: WsStatus) => void;
}

const appendApiKey = (url: string, apiKey?: string) => {
  if (!apiKey) return url;
  try {
    const target = new URL(url);
    target.searchParams.set("api_key", apiKey);
    return target.toString();
  } catch {
    return url;
  }
};

export class ChatWebSocket {
  private ws?: WebSocket;
  private shouldReconnect = true;
  private reconnectAttempts = 0;

  constructor(private options: ChatWsOptions) {
    this.connect();
  }

  private setStatus(status: WsStatus) {
    this.options.onStatusChange?.(status);
  }

  private connect() {
    this.cleanup();
    this.setStatus("connecting");
    const targetUrl = appendApiKey(this.options.url, this.options.apiKey);
    try {
      this.ws = new WebSocket(targetUrl);
    } catch (error) {
      console.error("Failed to create WebSocket", error);
      this.scheduleReconnect();
      return;
    }
    const socket = this.ws;
    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected");
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamEvent;
        this.options.onEvent(payload);
      } catch (error) {
        console.warn("Unable to parse WS payload", error);
      }
    };
    socket.onerror = () => {
      this.setStatus("disconnected");
      this.options.onEvent({ type: "error", message: "WebSocket error" });
    };
    socket.onclose = () => {
      this.setStatus("disconnected");
      this.options.onEvent({ type: "error", message: "WebSocket closed" });
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 10000);
    setTimeout(() => this.connect(), delay);
  }

  private cleanup() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.ws.onclose = null;
      this.ws.close();
    }
  }

  updateConfig(url: string, apiKey?: string) {
    this.options.url = url;
    this.options.apiKey = apiKey;
    this.reconnectAttempts = 0;
    this.connect();
  }

  send(payload: unknown): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  abortStream() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(4000, "client abort");
    }
  }

  destroy() {
    this.shouldReconnect = false;
    this.cleanup();
  }
}
