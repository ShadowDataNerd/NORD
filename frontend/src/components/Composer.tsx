import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatParams, ChatStatus } from "@/lib/types";
import { Send, Square } from "lucide-react";

interface ComposerProps {
  onSend: (content: string) => void;
  onAbort: () => void;
  status: ChatStatus;
  params: ChatParams;
  setParams: (params: Partial<ChatParams>) => void;
}

const Composer = ({ onSend, onAbort, status, params, setParams }: ComposerProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  }, [onSend, value]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-xl">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Temperature</span>
            <span>{params.temperature.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.01}
            value={[params.temperature]}
            onValueChange={([val]) => {
              const next = typeof val === "number" ? Number(val.toFixed(2)) : params.temperature;
              setParams({ temperature: next });
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Top-p</span>
            <span>{params.top_p.toFixed(2)}</span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[params.top_p]}
            onValueChange={([val]) => {
              const next = typeof val === "number" ? Number(val.toFixed(2)) : params.top_p;
              setParams({ top_p: next });
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Seed (optional)</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="text-slate-500">?</TooltipTrigger>
                <TooltipContent>Leer lassen für zufällige Seeds.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="number"
            min={0}
            placeholder="z.B. 42"
            value={params.seed ?? ""}
            onChange={(event) => setParams({ seed: event.target.value ? Number(event.target.value) : null })}
          />
        </div>
      </div>
      <Textarea
        placeholder="Stell eine Frage oder verwende Shift+Enter für einen Zeilenumbruch"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Enter zum Senden · Shift+Enter für neue Zeile</p>
        <div className="flex items-center gap-2">
          {status === "streaming" && (
            <Button variant="outline" onClick={onAbort} className="gap-2 text-rose-300">
              <Square className="h-4 w-4" />
              Abbrechen
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={status === "streaming" || !value.trim()} className="gap-2">
            <Send className="h-4 w-4" />
            Senden
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Composer;
