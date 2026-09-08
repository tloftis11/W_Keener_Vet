"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/supabase/types";
import { DEFAULT_RESPONSE_MODE, type ResponseMode } from "@/lib/claude/mode";

const POLL_INTERVAL_MS = 4000;

interface MessagesResponse {
  messages: Message[];
  status: "active" | "escalated" | "resolved";
  customerName: string | null;
  customerContact: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChatWidget({ showHeader = true }: { showHeader?: boolean }) {
  // Deliberately not persisted (e.g. localStorage) — every page load starts
  // a brand new conversation.
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<ResponseMode>(DEFAULT_RESPONSE_MODE);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Guards against a duplicate send: `sending` state updates are async, so two
  // rapid Enter presses/clicks can both read it as false before a re-render.
  // A ref is checked/set synchronously within the same call, closing that gap.
  const sendingRef = useRef(false);

  const [contactDismissed, setContactDismissed] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const { data, mutate } = useSWR<MessagesResponse>(
    conversationId ? `/api/conversations/${conversationId}/messages` : null,
    fetcher,
    // Paused while a send is in flight — otherwise a periodic poll can land
    // mid-request and show the persisted reply while the local "thinking"
    // bubble (cleared separately, once handleSend's own await resolves) is
    // still on screen, briefly rendering the exchange twice.
    { refreshInterval: sending ? 0 : POLL_INTERVAL_MS }
  );

  const messages = data?.messages ?? [];
  const status = data?.status ?? "active";
  const needsContact = status === "escalated" && !data?.customerContact && !contactDismissed;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingText]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;

    setSending(true);
    setPendingText(text);
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
      }

      const res = await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode: responseMode }),
      });
      if (!res.ok) throw new Error("Message failed to send");

      // Re-fetch the full thread rather than trying to splice in the
      // response — simplest way to stay consistent with what polling would
      // otherwise return.
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      sendingRef.current = false;
      setSending(false);
      setPendingText(null);
    }
  }

  async function handleSaveContact() {
    if (!conversationId || !contactValue.trim() || contactSaving) return;

    setContactSaving(true);
    setContactError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: contactName.trim(), contact: contactValue.trim() }),
      });
      if (!res.ok) throw new Error("Couldn't save your contact info — try again?");
      await mutate();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setContactSaving(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && (
        <header className="border-b pb-3">
          <h1 className="text-xl font-semibold">Ask Us About Your Pet</h1>
          <p className="text-sm text-gray-500">
            Describe what&apos;s going on — we&apos;ll help where we can, and loop in a vet
            for anything that needs their judgment.
          </p>
        </header>
      )}

      <div className="flex items-center gap-2 border-b py-2.5">
        <span className="text-xs text-gray-500">Reply style:</span>
        <div className="flex rounded-full border border-gray-200 p-0.5 text-xs">
          <button
            onClick={() => setResponseMode("simple")}
            className={`rounded-full px-2.5 py-1 font-medium transition ${
              responseMode === "simple" ? "bg-gray-900 text-white" : "text-gray-500"
            }`}
          >
            Simple
          </button>
          <button
            onClick={() => setResponseMode("detailed")}
            className={`rounded-full px-2.5 py-1 font-medium transition ${
              responseMode === "detailed" ? "bg-gray-900 text-white" : "text-gray-500"
            }`}
          >
            Detailed
          </button>
        </div>
      </div>

      {status === "escalated" && (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          A vet has been notified about this conversation and will reply here as soon
          as they can. Feel free to keep adding details.
        </div>
      )}

      {needsContact && (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm font-medium text-gray-900">
            How can a vet reach you if you step away from this chat?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <input
              className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Phone or email"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
            />
          </div>
          {contactError && <p className="text-xs text-red-600">{contactError}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveContact}
              disabled={contactSaving || !contactValue.trim()}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {contactSaving ? "Saving..." : "Share contact info"}
            </button>
            <button
              onClick={() => setContactDismissed(true)}
              className="text-xs text-gray-500 hover:underline"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pendingText && (
          <>
            <MessageBubble
              message={{
                id: "pending-customer",
                conversation_id: conversationId ?? "",
                sender_type: "customer",
                sender_id: null,
                body: pendingText,
                created_at: new Date().toISOString(),
              }}
            />
            <ThinkingBubble />
          </>
        )}
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

function ThinkingBubble() {
  return (
    <div className="flex justify-start" aria-live="polite" aria-label="Assistant is typing">
      <div className="max-w-[80%] rounded-lg bg-gray-100 px-3 py-2.5 text-sm text-gray-900">
        <div className="mb-0.5 text-[10px] uppercase tracking-wide opacity-60">Assistant</div>
        <div className="flex gap-1 py-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
        </div>
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
  const isBot = message.sender_type === "bot";
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
        {isBot ? (
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.body}</ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{message.body}</div>
        )}
      </div>
    </div>
  );
}
