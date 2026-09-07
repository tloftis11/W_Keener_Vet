"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useVetSession } from "@/lib/supabase/useVetSession";
import type { Conversation, Message } from "@/lib/supabase/types";

interface ThreadData {
  conversation: Conversation | null;
  messages: Message[];
}

async function fetchThread(conversationId: string): Promise<ThreadData> {
  const supabase = getBrowserClient();
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", conversationId).single(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);
  return { conversation: conversation ?? null, messages: messages ?? [] };
}

export default function ThreadView({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { session, loading: sessionLoading } = useVetSession();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) router.push("/vet/login");
  }, [sessionLoading, session, router]);

  const { data, mutate } = useSWR<ThreadData>(
    session ? ["thread", conversationId] : null,
    () => fetchThread(conversationId)
  );

  const conversation = data?.conversation ?? null;
  const messages = data?.messages ?? [];

  // The realtime subscription only triggers a revalidation via SWR's
  // `mutate` — this effect never calls a local setState directly.
  useEffect(() => {
    if (!session) return;

    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => mutate()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        () => mutate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, conversationId, mutate]);

  async function handleReply() {
    const text = reply.trim();
    if (!text || sending || !session) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/vet/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ conversationId, text }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setReply("");
      await mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    if (!session) return;
    await fetch("/api/vet/resolve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conversationId }),
    });
    router.push("/vet/dashboard");
  }

  if (sessionLoading || !session) return null;

  return (
    <div className="mx-auto flex h-screen w-full max-w-2xl flex-col p-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <Link href="/vet/dashboard" className="text-xs text-gray-400 hover:underline">
            ← Back to queue
          </Link>
          <h1 className="text-lg font-semibold">
            {conversation?.customer_name || "Anonymous customer"}
          </h1>
          <p
            className={`text-xs ${conversation?.customer_contact ? "text-gray-600" : "italic text-gray-400"}`}
          >
            {conversation?.customer_contact || "No contact info provided"}
          </p>
          {conversation?.urgency === "urgent" && (
            <span className="mt-1 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
              Urgent
            </span>
          )}
        </div>
        {conversation?.status !== "resolved" && (
          <button
            onClick={handleResolve}
            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            Mark resolved
          </button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && <p className="pb-2 text-sm text-red-600">{error}</p>}

      {conversation?.status !== "resolved" ? (
        <div className="flex gap-2 border-t pt-3">
          <input
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-gray-400"
            placeholder="Reply to the customer..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleReply();
              }
            }}
          />
          <button
            onClick={handleReply}
            disabled={sending || !reply.trim()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="border-t pt-3 text-center text-xs text-gray-400">
          This conversation has been marked resolved.
        </p>
      )}
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

  const isVet = message.sender_type === "vet";
  const label =
    message.sender_type === "customer" ? "Customer" : isVet ? "You" : "Assistant";

  return (
    <div className={`flex ${isVet ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isVet
            ? "bg-emerald-600 text-white"
            : message.sender_type === "customer"
              ? "bg-gray-100 text-gray-900"
              : "bg-gray-50 text-gray-700"
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
