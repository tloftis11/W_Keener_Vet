"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { Message } from "@/lib/supabase/types";

const STORAGE_KEY = "vet-chat-conversation-id";
const POLL_INTERVAL_MS = 4000;

interface MessagesResponse {
  messages: Message[];
  status: "active" | "escalated" | "resolved";
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CustomerChatPage() {
  // Reads whatever conversation this browser already started, if any — a
  // page refresh shouldn't lose an in-progress (possibly escalated,
  // possibly-still-waiting) conversation. A lazy useState initializer (rather
  // than an effect) keeps this a plain synchronous read with no extra render.
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY)
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, mutate } = useSWR<MessagesResponse>(
    conversationId ? `/api/conversations/${conversationId}/messages` : null,
    fetcher,
    { refreshInterval: POLL_INTERVAL_MS }
  );

  const messages = data?.messages ?? [];
  const status = data?.status ?? "active";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    setInput("");

    try {
      let convId = conversationId;
      if (!convId) {
        const res = await fetch("/api/conversations", { method: "POST" });
        if (!res.ok) throw new Error("Could not start a new conversation");
        const created = await res.json();
        convId = created.id;
        setConversationId(convId);
        window.localStorage.setItem(STORAGE_KEY, convId!);
      }

      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Message failed to send");

      // Re-fetch the full thread rather than trying to splice in the
      // response — simplest way to stay consistent with what polling would
      // otherwise return.
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <header className="border-b pb-3">
        <h1 className="text-xl font-semibold">Ask Us About Your Pet</h1>
        <p className="text-sm text-gray-500">
          Describe what&apos;s going on — we&apos;ll help where we can, and loop in a vet
          for anything that needs their judgment.
        </p>
      </header>

      {status === "escalated" && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A vet has been notified about this conversation and will reply here as soon
          as they can. Feel free to keep adding details.
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="pb-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-t pt-3">
        <input
          className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-gray-400"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.sender_type === "system") {
    return (
      <div className="mx-auto max-w-md rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
        {message.body}
      </div>
    );
  }

  const isCustomer = message.sender_type === "customer";
  const label = message.sender_type === "vet" ? "Vet" : isCustomer ? "You" : "Assistant";

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isCustomer
            ? "bg-gray-900 text-white"
            : message.sender_type === "vet"
              ? "bg-emerald-50 text-emerald-900"
              : "bg-gray-100 text-gray-900"
        }`}
      >
        <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">
          {label}
        </div>
        <div className="whitespace-pre-wrap">{message.body}</div>
      </div>
    </div>
  );
}
