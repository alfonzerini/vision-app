"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Live chat between the two parties on a job. Available once a job is assigned.
 * New messages arrive in real time; sends are optimistic.
 */
export function JobChat({
  jobId,
  currentUserId,
  otherPartyId,
  otherPartyName,
  initialMessages,
}: {
  jobId: string;
  currentUserId: string;
  otherPartyId: string;
  otherPartyName: string;
  initialMessages: ChatMessage[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Live updates + mark incoming as read.
  useEffect(() => {
    const channel = supabase
      .channel(`job-messages-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.some((x) => x.id === m.id) ? prev : [...prev, m],
          );
        },
      )
      .subscribe();

    // Best-effort: mark the other party's messages as read.
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("recipient_id", currentUserId)
      .is("read_at", null)
      .then(() => {});

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    setBody("");

    const { data, error: err } = await supabase
      .from("messages")
      .insert({
        job_id: jobId,
        sender_id: currentUserId,
        recipient_id: otherPartyId,
        body: text,
      })
      .select("id, sender_id, body, created_at")
      .single();

    setSending(false);
    if (err || !data) {
      setError("Couldn't send your message. Please try again.");
      setBody(text);
      return;
    }
    setMessages((prev) =>
      prev.some((x) => x.id === data.id) ? prev : [...prev, data],
    );
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-96 min-h-32 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-4">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No messages yet. Say hello to {otherPartyName} 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    mine
                      ? "bg-brand text-white"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      mine ? "text-white/70" : "text-muted"
                    }`}
                  >
                    {timeLabel(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
      )}

      <form onSubmit={send} className="mt-3 flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          rows={1}
          placeholder={`Message ${otherPartyName}…`}
          className="min-h-11 flex-1 resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
