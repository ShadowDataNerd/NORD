import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Settings {
  httpUrl: string;
  wsUrl: string;
  apiKey?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

const SettingsSheet = ({ open, onOpenChange, settings, onSave }: Props) => {
  const [local, setLocal] = useState<Settings>(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleSubmit = () => {
    onSave(local);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Verbindungseinstellungen</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">HTTP Base URL</label>
            <Input
              value={local.httpUrl}
              onChange={(event) => setLocal((prev) => ({ ...prev, httpUrl: event.target.value }))}
              placeholder="http://localhost:8000"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">WebSocket URL</label>
            <Input
              value={local.wsUrl}
              onChange={(event) => setLocal((prev) => ({ ...prev, wsUrl: event.target.value }))}
              placeholder="ws://localhost:8000/ws/chat"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500">API Key (optional)</label>
            <Input
              value={local.apiKey || ""}
              onChange={(event) => setLocal((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder="x-api-key"
            />
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit}>Speichern</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
