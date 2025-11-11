import { Bot, User } from "lucide-react";
import MarkdownRender from "./MarkdownRender";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  message: Message;
}

const MessageBubble = ({ message }: Props) => {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-200">
          <Bot className="h-5 w-5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-3xl rounded-2xl border border-slate-800/60 bg-slate-900/80 p-4 text-sm leading-relaxed shadow-sm",
          isUser && "bg-blue-500/10 text-blue-50"
        )}
      >
        {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <MarkdownRender content={message.content || "..."} />}
        <p className="mt-2 text-xs text-slate-500">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {isUser && (
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-200">
          <User className="h-5 w-5" />
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
