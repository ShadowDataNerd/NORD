import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import TopBar from "@/components/TopBar";
import ChatWindow from "@/components/ChatWindow";
import Composer from "@/components/Composer";
import SettingsSheet from "@/components/SettingsSheet";
import StatsBar from "@/components/StatsBar";
import { useChat } from "@/hooks/useChat";
import { getModels } from "@/lib/api";
import type { ChatConfig, Message, ModelInfo } from "@/lib/types";

const SETTINGS_KEY = "jetson-chat-settings-v1";
const defaultSettings: ChatConfig = {
  httpUrl: "http://localhost:8000",
  wsUrl: "ws://localhost:8000/ws/chat",
  apiKey: ""
};

const loadSettings = (): ChatConfig => {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as ChatConfig;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

const safeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
};

const sanitizeMessages = (messages: Message[]): Message[] => {
  return messages
    .filter((message) => ["user", "assistant", "system"].includes(message.role))
    .map((message) => ({
      ...message,
      id: message.id || safeId(),
      createdAt: message.createdAt || Date.now()
    }));
};

const App = () => {
  const [settings, setSettings] = useState<ChatConfig>(loadSettings);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const config = useMemo<ChatConfig>(() => ({
    httpUrl: settings.httpUrl,
    wsUrl: settings.wsUrl,
    apiKey: settings.apiKey || undefined
  }), [settings]);

  const chat = useChat(config);

  const { model, setModel } = chat;

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await getModels(config);
        setModels(data);
        if (data.length && !data.find((entry) => entry.name === model)) {
          setModel(data[0].name);
        }
      } catch (error) {
        toast.error("Modelle konnten nicht geladen werden");
        console.error(error);
      }
    };
    fetchModels();
  }, [config, model, setModel]);

  const handleSend = (content: string) => chat.sendPrompt(content);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(chat.messages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (incoming: Message[]) => {
    const sanitized = sanitizeMessages(incoming);
    chat.importHistory(sanitized);
    toast.success("Verlauf aktualisiert");
  };

  const handleSaveSettings = (next: ChatConfig) => {
    setSettings(next);
    toast.success("Einstellungen gespeichert");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto flex h-screen max-w-6xl flex-col gap-6 px-4 py-6">
        <TopBar
          models={models.length ? models : [{ name: model }]}
          model={model}
          onModelChange={setModel}
          onNewChat={chat.clear}
          onImport={handleImport}
          onExport={handleExport}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <ChatWindow messages={chat.messages} status={chat.status} />
          <Composer onSend={handleSend} onAbort={chat.abort} status={chat.status} params={chat.params} setParams={chat.setParams} />
          <StatsBar
            latencyMs={chat.latencyMs}
            tokensPerSecond={chat.tokensPerSecond}
            model={model}
            transport={chat.transport}
            wsStatus={chat.wsStatus}
          />
        </div>
      </div>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onSave={handleSaveSettings} />
    </div>
  );
};

export default App;
