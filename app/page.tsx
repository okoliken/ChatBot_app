"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.body) throw new Error("No response body");

      // Read the streamed text chunk by chunk and append it to the last message.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "**Error:** couldn't reach the server." };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex h-dvh flex-col">
      <header className="border-b border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10">
        Chat Bot
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {messages.length === 0 && (
            <p className="mt-32 text-center text-2xl font-medium opacity-70">How can I help?</p>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="max-w-[80%] self-end whitespace-pre-wrap rounded-3xl bg-black/5 px-4 py-2.5 dark:bg-white/10">
                {m.content}
              </div>
            ) : (
              <div key={i} className="prose prose-neutral max-w-none dark:prose-invert">
                {m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                ) : (
                  <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-current" />
                )}
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mx-auto w-full max-w-3xl px-4 pb-6"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-black/15 bg-background p-2 shadow-sm dark:border-white/15">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="Message the agent…"
            className="max-h-48 flex-1 resize-none bg-transparent px-3 py-2 outline-none field-sizing-content"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-9 w-9 shrink-0 rounded-full bg-foreground text-background disabled:opacity-30"
            aria-label="Send"
          >
            ↑
          </button>
        </div>
      </form>
    </main>
  );
}
