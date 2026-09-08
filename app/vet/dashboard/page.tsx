"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useVetSession } from "@/lib/supabase/useVetSession";
import VetTopBar from "@/components/vet/VetTopBar";
import type { Conversation, Message } from "@/lib/supabase/types";

interface QueueRow extends Conversation {
  lastMessageSenderType: Message["sender_type"] | null;
}

type Tab = "waiting" | "resolved";

function formatRelativeTime(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

async function fetchQueue(tab: Tab): Promise<QueueRow[]> {
  const supabase = getBrowserClient();
  const status = tab === "waiting" ? "escalated" : "resolved";

  // Fetched unsorted from the DB — final ordering is computed below since
  // 'urgent' < 'routine' alphabetically doesn't match the priority we want.
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", status);

  if (!conversations) return [];

  const ids = conversations.map((c) => c.id);
  const lastByConversation = new Map<string, Message["sender_type"]>();

  if (ids.length) {
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("*")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });

    if (recentMessages) {
      for (const m of recentMessages) {
        if (!lastByConversation.has(m.conversation_id)) {
          lastByConversation.set(m.conversation_id, m.sender_type);
        }
      }
    }
  }

  const rows: QueueRow[] = conversations.map((c) => ({
    ...c,
    lastMessageSenderType: lastByConversation.get(c.id) ?? null,
  }));

  if (tab === "waiting") {
    // Urgent first, then longest-waiting first within each group.
    rows.sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === "urgent" ? -1 : 1;
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    });
  } else {
    // Most recently resolved first.
    rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  return rows;
}

export default function VetDashboardPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useVetSession();
  const [tab, setTab] = useState<Tab>("waiting");

  useEffect(() => {
    if (!sessionLoading && !session) router.push("/vet/login");
  }, [sessionLoading, session, router]);

  const { data: rows, isLoading, mutate } = useSWR<QueueRow[]>(
    session ? ["vet-queue", tab] : null,
    () => fetchQueue(tab),
    { refreshInterval: 15000 }
  );

  // The realtime subscription only triggers a revalidation — `mutate` comes
  // from SWR and owns the actual state update, so this effect never calls a
  // local setState itself.
  useEffect(() => {
    if (!session) return;

    const supabase = getBrowserClient();
    const channel = supabase
      .channel("vet-dashboard-queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => mutate()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => mutate()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, mutate]);

  if (sessionLoading || !session) return null;

  return (
    <div className="min-h-screen">
      <VetTopBar />
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="mb-1 font-display text-xl text-ink">Vet Queue</h1>
        <p className="mb-6 text-sm text-ink-soft">
          Conversations waiting on a vet, urgent cases first.
        </p>

        <div className="mb-5 flex rounded-full border border-line p-0.5 text-xs w-fit">
          <button
            onClick={() => setTab("waiting")}
            aria-pressed={tab === "waiting"}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              tab === "waiting" ? "bg-accent text-white" : "text-ink-soft"
            }`}
          >
            Waiting
          </button>
          <button
            onClick={() => setTab("resolved")}
            aria-pressed={tab === "resolved"}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              tab === "resolved" ? "bg-accent text-white" : "text-ink-soft"
            }`}
          >
            Resolved
          </button>
        </div>

        {isLoading && <p className="text-sm text-ink-soft">Loading...</p>}
        {!isLoading && rows?.length === 0 && (
          <p className="text-sm text-ink-soft">
            {tab === "waiting" ? "Nothing waiting right now." : "No resolved conversations yet."}
          </p>
        )}

        <ul className="space-y-2">
          {(rows ?? []).map((row) => {
            const awaitingVet =
              tab === "waiting" &&
              (row.lastMessageSenderType === "customer" ||
                row.lastMessageSenderType === "system");
            const isUrgent = row.urgency === "urgent";
            return (
              <li key={row.id}>
                <Link
                  href={`/vet/dashboard/${row.id}`}
                  className={`flex flex-col gap-1 rounded-md border bg-surface px-4 py-3 text-sm hover:bg-accent-soft/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                    isUrgent
                      ? "border-l-4 border-l-red-500 border-y-line border-r-line bg-red-50/50"
                      : "border-line"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">
                        {row.customer_name || "Anonymous customer"}
                      </span>
                      {isUrgent && (
                        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                          Urgent
                        </span>
                      )}
                      {awaitingVet && (
                        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-dark">
                          New
                        </span>
                      )}
                    </div>
                    {!row.customer_contact && (
                      <p className="mt-0.5 text-[11px] italic text-ink-faint">
                        No contact info on file
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {tab === "waiting" ? "waiting" : "resolved"}{" "}
                    {formatRelativeTime(row.updated_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
