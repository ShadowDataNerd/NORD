import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Message, ModelInfo } from "@/lib/types";
import { FileDown, FileUp, RefreshCcw, Settings, Sparkles } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import toast from "react-hot-toast";

interface Props {
  models: ModelInfo[];
  model: string;
  onModelChange: (model: string) => void;
  onNewChat: () => void;
  onImport: (messages: Message[]) => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

const TopBar = ({ models, model, onModelChange, onNewChat, onImport, onExport, onOpenSettings }: Props) => {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const payload = JSON.parse(text) as Message[];
        onImport(payload);
        toast.success("Verlauf importiert");
      } catch (error) {
        toast.error("Import fehlgeschlagen");
        console.error("Invalid import", error);
      } finally {
        event.target.value = "";
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-100">Jetson Chat Gateway</p>
          <p className="text-xs text-slate-500">lokale LLM-Steuerzentrale</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Modell" />
          </SelectTrigger>
          <SelectContent>
            {models.map((entry) => (
              <SelectItem key={entry.name} value={entry.name}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={onNewChat}>
          <RefreshCcw className="h-4 w-4" />
          Neuer Chat
        </Button>
        <Button variant="outline" className="gap-2" onClick={onExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleImportClick}>
          <FileUp className="h-4 w-4" />
          Import
        </Button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
        <Button variant="default" className="gap-2" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
