import type { TransportKind } from "@/lib/types";
import type { WsStatus } from "@/lib/ws";
import { Activity, Cpu, PlugZap, Timer } from "lucide-react";

interface Props {
  latencyMs?: number;
  tokensPerSecond?: number;
  model: string;
  transport: TransportKind;
  wsStatus: WsStatus;
}

const statusColor = {
  connected: "text-emerald-400",
  connecting: "text-amber-300",
  disconnected: "text-rose-400"
} as const;

const StatsBar = ({ latencyMs, tokensPerSecond, model, transport, wsStatus }: Props) => {
  const transportLabel = transport === "none" ? "IDLE" : transport.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-400">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4" />
        <span>{latencyMs ? `${latencyMs.toFixed(0)} ms` : "Latency n/a"}</span>
      </div>
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4" />
        <span>{tokensPerSecond ? `${tokensPerSecond.toFixed(1)} tok/s` : "Token/s n/a"}</span>
      </div>
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4" />
        <span>{model}</span>
      </div>
      <div className="flex items-center gap-2">
        <PlugZap className="h-4 w-4" />
        <span className={statusColor[wsStatus] ?? "text-slate-500"}>WS {wsStatus}</span>
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-wide">{transportLabel}</span>
      </div>
    </div>
  );
};

export default StatsBar;
