"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useVetSession } from "@/lib/supabase/useVetSession";
import VetTopBar from "@/components/vet/VetTopBar";
import AutoGrowTextarea from "@/components/AutoGrowTextarea";
import type { Conversation, Message } from "@/lib/supabase/types";

interface LatestEscalation {
  category: string;
  reason: string;
  created_at: string;
}

interface ThreadData {
  conversation: Conversation | null;
  messages: Message[];
  latestEscalation: LatestEscalation | null;
}

async function fetchThread(conversationId: string): Promise<ThreadData> {
  const supabase = getBrowserClient();
  const [{ data: conversation }, { data: messages }, { data: escalations }] = await Promise.all([
    supabase.from("conversations").select("*").eq("id", conversationId).single(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("escalation_events")
      .select("category, reason, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  return {
    conversation: conversation ?? null,
    messages: messages ?? [],
    latestEscalation: escalations?.[0] ?? null,
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  medication: "Medication",
  procedure: "Procedure",
  emergency: "Emergency",
};

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
  const latestEscalation = data?.latestEscalation ?? null;

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
    if (!window.confirm("Mark this conversation as resolved?")) return;
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
    <div className="flex h-screen flex-col">
      <VetTopBar />
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-hidden p-3 sm:p-4">
        <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/vet/dashboard"
              className="text-xs text-ink-faint hover:text-ink hover:underline"
            >
              ← Back to queue
            </Link>
            <h1 className="font-display text-lg text-ink">
              {conversation?.customer_name || "Anonymous customer"}
            </h1>
            <p
              className={`text-xs ${conversation?.customer_contact ? "text-ink-soft" : "italic text-ink-faint"}`}
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
              className="self-start rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-accent-soft sm:self-auto"
            >
              Mark resolved
            </button>
          )}
        </div>

        {latestEscalation && (
          <div className="mt-3 rounded-md border border-line bg-accent-soft/60 px-3 py-2 text-xs text-ink-soft">
            <span className="mr-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
              {CATEGORY_LABELS[latestEscalation.category] ?? latestEscalation.category}
            </span>
            {latestEscalation.reason}
          </div>
        )}

        <div
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="flex-1 space-y-3 overflow-y-auto py-4"
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>

        {error && <p className="pb-2 text-sm text-red-600">{error}</p>}

        {conversation?.status !== "resolved" ? (
          <div className="flex gap-2 border-t border-line pt-3">
            <AutoGrowTextarea
              value={reply}
              onChange={setReply}
              onSubmit={handleReply}
              placeholder="Reply to the customer..."
              ariaLabel="Reply to the customer"
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-40"
            >
              Send
            </button>
          </div>
        ) : (
          <p className="border-t border-line pt-3 text-center text-xs text-ink-faint">
            This conversation has been marked resolved.
          </p>
        )}
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

  const isVet = message.sender_type === "vet";
  const label =
    message.sender_type === "customer" ? "Customer" : isVet ? "You" : "Assistant";

  return (
    <div className={`flex ${isVet ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isVet
            ? "bg-accent text-white"
            : message.sender_type === "customer"
              ? "border border-line bg-surface text-ink"
              : "bg-accent-soft text-ink"
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
