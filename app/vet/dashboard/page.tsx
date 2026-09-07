"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useVetSession } from "@/lib/supabase/useVetSession";
import type { Conversation, Message } from "@/lib/supabase/types";

interface QueueRow extends Conversation {
  lastMessageSenderType: Message["sender_type"] | null;
}

async function fetchQueue(): Promise<QueueRow[]> {
  const supabase = getBrowserClient();

  // Fetched unsorted from the DB — final urgent-first / longest-waiting
  // ordering is computed below since 'urgent' < 'routine' alphabetically
  // doesn't match the priority we actually want.
  const { data: conversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", "escalated");

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

  // Urgent first, then longest-waiting first within each group.
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "urgent" ? -1 : 1;
    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
  });

  return rows;
}

export default function VetDashboardPage() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useVetSession();

  useEffect(() => {
    if (!sessionLoading && !session) router.push("/vet/login");
  }, [sessionLoading, session, router]);

  const { data: rows, isLoading, mutate } = useSWR<QueueRow[]>(
    session ? "vet-queue" : null,
    fetchQueue,
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold">Vet Queue</h1>
      <p className="mb-6 text-sm text-gray-500">
        Conversations waiting on a vet, urgent cases first.
      </p>

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
      {!isLoading && rows?.length === 0 && (
        <p className="text-sm text-gray-500">Nothing waiting right now.</p>
      )}

      <ul className="space-y-2">
        {(rows ?? []).map((row) => {
          const awaitingVet =
            row.lastMessageSenderType === "customer" ||
            row.lastMessageSenderType === "system";
          return (
            <li key={row.id}>
              <Link
                href={`/vet/dashboard/${row.id}`}
                className={`flex flex-col gap-1 rounded-md border px-4 py-3 text-sm hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                  row.urgency === "urgent" ? "border-red-300 bg-red-50" : ""
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {row.customer_name || "Anonymous customer"}
                    </span>
                    {row.urgency === "urgent" && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Urgent
                      </span>
                    )}
                    {awaitingVet && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-800">
                        New
                      </span>
                    )}
                  </div>
                  {!row.customer_contact && (
                    <p className="mt-0.5 text-[11px] italic text-gray-400">
                      No contact info on file
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  waiting since {new Date(row.updated_at).toLocaleString()}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
