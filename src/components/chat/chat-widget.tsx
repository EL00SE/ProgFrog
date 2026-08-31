"use client";

import * as React from "react";
import { MessageCircle, Send, X } from "lucide-react";

import { grantChatConsent } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget({ consented: initialConsent }: { consented: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [consented, setConsented] = React.useState(initialConsent);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  async function acceptConsent() {
    setBusy(true);
    try {
      await grantChatConsent();
      setConsented(true);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        if (res.status === 403 && j?.error === "consent_required") setConsented(false);
        setError(
          res.status === 503
            ? "The assistant isn't switched on for this app yet."
            : "Something went wrong. Try again.",
        );
        setMessages(next);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        setError("Something went wrong. Try again.");
        setMessages(next);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open training assistant"
          className="bg-primary text-primary-foreground hover:bg-primary/92 fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-4 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 md:bottom-6"
        >
          <MessageCircle className="size-5" />
        </button>
      )}

      {open && (
        <div className="bg-popover text-popover-foreground ring-foreground/10 fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Training assistant</p>
              <p className="text-muted-foreground text-xs">
                Coaching from your logged data
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={() => {
                abortRef.current?.abort();
                setOpen(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>

          {!consented ? (
            <div className="flex flex-col gap-3 p-4 text-sm">
              <p className="font-medium">Before you start</p>
              <p className="text-muted-foreground">
                To give useful advice, the assistant is shown your{" "}
                <b>workout history, body measurements, and templates</b> from this app. It
                can&rsquo;t see anything else, and your data isn&rsquo;t used to train AI
                models.
              </p>
              <Button onClick={acceptConsent} disabled={busy} className="mt-1 w-full">
                Got it — start chatting
              </Button>
            </div>
          ) : (
            <>
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 text-sm"
              >
                {messages.length === 0 && (
                  <p className="text-muted-foreground">
                    Ask about your progress, what to train next, whether to add weight,
                    how a lift is trending…
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted",
                    )}
                  >
                    {m.content ||
                      (busy && i === messages.length - 1 ? (
                        <span className="text-muted-foreground">thinking…</span>
                      ) : null)}
                  </div>
                ))}
                {error && <p className="text-destructive text-xs">{error}</p>}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-end gap-2 border-t p-3"
              >
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
                  placeholder="Ask your coach…"
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 max-h-28 min-h-9 flex-1 resize-none rounded-md border bg-transparent px-3 py-1.5 text-sm outline-none focus-visible:ring-[3px]"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
