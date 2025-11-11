import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import type { ChatStatus, Message } from "@/lib/types";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: Message[];
  status: ChatStatus;
}

const ChatWindow = ({ messages, status }: Props) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, status]);

  return (
    <Card className="flex h-full flex-col bg-slate-950/70">
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full" viewportRef={scrollRef}>
          <div className="flex flex-col gap-4 p-6">
            {messages.length === 0 && (
              <div className="mt-20 text-center text-slate-500">
                <p className="text-lg font-medium">Stelle deine erste Frage</p>
                <p className="text-sm text-slate-500">Modelle wählen, Parameter anpassen und los geht's.</p>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {status === "streaming" && <div className="animate-pulse text-sm text-slate-500">Antwort wird generiert …</div>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default ChatWindow;
