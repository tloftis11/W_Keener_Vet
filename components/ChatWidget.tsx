"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/supabase/types";
import { DEFAULT_RESPONSE_MODE, type ResponseMode } from "@/lib/claude/mode";
import AutoGrowTextarea from "@/components/AutoGrowTextarea";
import NearbyVetsPanel from "@/components/NearbyVetsPanel";
import HowItWorksModal from "@/components/HowItWorksModal";
import { AiMarker, PersonMarker } from "@/components/SenderMarkers";
import type { VetResult } from "@/lib/geo/geoapify";

const POLL_INTERVAL_MS = 4000;
const NEARBY_VET_CATEGORIES = new Set(["medication", "procedure", "emergency"]);

interface MessagesResponse {
  messages: Message[];
  status: "active" | "escalated" | "resolved";
  urgency: "routine" | "urgent" | null;
  customerName: string | null;
  customerContact: string | null;
  escalationCategory: string | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChatWidget({ showHeader = true }: { showHeader?: boolean }) {
  // Resumable via URL (?c=<id>), written into the address bar the moment a
  // conversation is created — not localStorage, so it's shareable/bookmarkable
  // rather than tied to one browser. Anyone with the link can open it, same
  // trust model as any unlisted-link document; the API already accepted any
  // conversation id with no auth check, this just makes that id visible
  // rather than only held in memory. Visiting the bare URL still starts fresh.
  const [conversationId, setConversationId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("c")
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<ResponseMode>(DEFAULT_RESPONSE_MODE);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
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

  const [nearbyPanelOpen, setNearbyPanelOpen] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyResults, setNearbyResults] = useState<VetResult[] | null>(null);
  const [nearbyIsEmergency, setNearbyIsEmergency] = useState(false);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  // Tracks the status seen on the previous render so a lookup triggers once
  // per new escalation (status transitioning into "escalated"), not on every
  // poll while it stays escalated.
  const prevStatusRef = useRef<string | null>(null);

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
  const urgency = data?.urgency ?? null;
  const escalationCategory = data?.escalationCategory ?? null;
  const needsContact = status === "escalated" && !data?.customerContact && !contactDismissed;

  // The server saves the customer's message immediately, well before the
  // (slow) classifier + chat calls finish — so a poll can land mid-request
  // and show it via `messages` while the local echo bubble below is still
  // up too. Rather than race that timing, just don't render the echo once
  // the real thing has shown up.
  const lastMessage = messages[messages.length - 1];
  const pendingAlreadyPersisted =
    !!pendingText &&
    lastMessage?.sender_type === "customer" &&
    lastMessage.body === pendingText;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingText]);

  async function fetchNearby(params: { lat: number; lon: number } | { query: string }, isEmergency: boolean) {
    setNeedsLocation(false);
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const res = await fetch("/api/nearby-vets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, isEmergency }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Couldn't look up nearby vets");
      setNearbyResults(json.results);
    } catch (err) {
      setNearbyError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setNearbyLoading(false);
    }
  }

  function triggerNearbyLookup(isEmergency: boolean) {
    setNearbyIsEmergency(isEmergency);
    setNearbyPanelOpen(true);
    setNearbyResults(null);
    setNearbyError(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNeedsLocation(true);
      return;
    }

    setNearbyLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchNearby({ lat: pos.coords.latitude, lon: pos.coords.longitude }, isEmergency),
      () => {
        setNearbyLoading(false);
        setNeedsLocation(true);
      },
      { timeout: 8000 }
    );
  }

  function handleLocationSubmit() {
    if (!locationQuery.trim()) return;
    fetchNearby({ query: locationQuery.trim() }, nearbyIsEmergency);
  }

  // Fires once per new escalation (status transitioning into "escalated"),
  // not on every poll while it stays escalated.
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      prevStatus !== "escalated" &&
      status === "escalated" &&
      escalationCategory &&
      NEARBY_VET_CATEGORIES.has(escalationCategory)
    ) {
      triggerNearbyLookup(escalationCategory === "emergency");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, escalationCategory]);

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
        const url = new URL(window.location.href);
        url.searchParams.set("c", convId!);
        window.history.replaceState(null, "", url);
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
      if (!res.ok) throw new Error("Couldn't save your contact info. Try again?");
      await mutate();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setContactSaving(false);
    }
  }

  const showGreeting = messages.length === 0 && !pendingText;

  return (
    <div className="flex h-full w-full flex-col">
      {showHeader && (
        <header className="border-b border-line pb-3">
          <h1 className="font-display text-xl text-ink">Ask Us About Your Pet</h1>
          <p className="text-sm text-ink-soft">
            Tell us what&apos;s going on. We&apos;ll help where we can, and bring in a vet
            for anything that needs their judgment.
          </p>
        </header>
      )}

      <div className="sticky top-0 z-10 bg-surface">
        <div className="flex items-center gap-2 border-b border-line py-2.5">
          <span className="text-xs text-ink-faint">Reply style:</span>
          <div className="flex rounded-full border border-line p-0.5 text-xs">
            <button
              onClick={() => setResponseMode("detailed")}
              aria-pressed={responseMode === "detailed"}
              className={`rounded-full px-2.5 py-1 font-medium transition ${
                responseMode === "detailed" ? "bg-accent text-white" : "text-ink-soft"
              }`}
            >
              Detailed
            </button>
            <button
              onClick={() => setResponseMode("simple")}
              aria-pressed={responseMode === "simple"}
              className={`rounded-full px-2.5 py-1 font-medium transition ${
                responseMode === "simple" ? "bg-accent text-white" : "text-ink-soft"
              }`}
            >
              Simple
            </button>
          </div>
          <button
            onClick={() => setShowModeInfo((v) => !v)}
            aria-label="What do these mean?"
            aria-expanded={showModeInfo}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] text-ink-faint hover:border-accent hover:text-accent"
          >
            i
          </button>
          <button
            onClick={() => setShowHowItWorks(true)}
            className="ml-auto text-xs text-ink-faint hover:text-ink hover:underline"
          >
            How this works
          </button>
        </div>
        {showModeInfo && (
          <p className="border-b border-line bg-accent-soft/40 px-0.5 py-2 text-xs text-ink-soft">
            <strong className="font-medium text-ink">Detailed</strong> gives fuller
            explanations and asks follow-up questions.{" "}
            <strong className="font-medium text-ink">Simple</strong> keeps answers short
            and plain. Good if longer responses are hard to read.
          </p>
        )}
      </div>

      {status === "escalated" &&
        (urgency === "urgent" ? (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            <span className="font-semibold">This has been flagged as urgent.</span> A vet
            has been notified right away and will reply here as soon as possible. If things
            seem to be getting worse, please call us or head to your nearest emergency vet.
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A vet has been notified about this conversation and will reply here as soon
            as they can. Feel free to keep adding details.
          </div>
        ))}

      {status === "escalated" && (
        <p className="mt-1.5 text-[11px] text-ink-faint">
          This conversation is saved at this page&apos;s link. Bookmark it if you want to
          come back.
        </p>
      )}

      {status === "escalated" &&
        escalationCategory &&
        NEARBY_VET_CATEGORIES.has(escalationCategory) &&
        !nearbyPanelOpen && (
          <button
            onClick={() => setNearbyPanelOpen(true)}
            className="mt-2 self-start text-xs text-accent hover:underline"
          >
            {escalationCategory === "emergency" ? "View nearest emergency vets" : "View nearby vet clinics"}
          </button>
        )}

      {status === "resolved" && (
        <div className="mt-3 rounded-md border border-line bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          This conversation was marked resolved. Send a message below if you have a new
          question or this comes back.
        </div>
      )}

      {needsContact && (
        <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-sm font-medium text-ink">
            How can a vet reach you if you step away from this chat?
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Your name"
              aria-label="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <input
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              placeholder="Phone or email"
              aria-label="Phone or email"
              value={contactValue}
              onChange={(e) => setContactValue(e.target.value)}
            />
          </div>
          {contactError && <p className="text-xs text-red-600">{contactError}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveContact}
              disabled={contactSaving || !contactValue.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-dark disabled:opacity-40"
            >
              {contactSaving ? "Saving..." : "Share contact info"}
            </button>
            <button
              onClick={() => setContactDismissed(true)}
              className="text-xs text-ink-faint hover:text-ink hover:underline"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 space-y-3 overflow-y-auto py-4"
      >
        {showGreeting && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">
              <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-60">
                <AiMarker className="h-2.5 w-2.5" />
                Assistant
              </div>
              Hi! Tell me what&apos;s going on with your pet, or ask about hours, services,
              or anything else. Happy to help.
            </div>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pendingText && (
          <>
            {!pendingAlreadyPersisted && (
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
            )}
            <ThinkingBubble />
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="pb-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 border-t border-line pt-3">
        <AutoGrowTextarea
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          placeholder="Type a message..."
          ariaLabel="Type a message"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="self-end rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-40"
        >
          Send
        </button>
      </div>

      {nearbyPanelOpen && (
        <NearbyVetsPanel
          onClose={() => setNearbyPanelOpen(false)}
          loading={nearbyLoading}
          error={nearbyError}
          results={nearbyResults}
          isEmergency={nearbyIsEmergency}
          needsLocation={needsLocation}
          locationValue={locationQuery}
          onLocationChange={setLocationQuery}
          onLocationSubmit={handleLocationSubmit}
        />
      )}

      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start" aria-label="Assistant is typing">
      <div className="max-w-[80%] rounded-lg bg-accent-soft px-3 py-2.5 text-sm text-ink">
        <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-60">
          <AiMarker className="h-2.5 w-2.5" />
          Assistant
        </div>
        <div className="flex gap-1 py-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60" />
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
            ? "bg-accent text-white"
            : message.sender_type === "vet"
              ? "bg-ink text-white"
              : "bg-accent-soft text-ink"
        }`}
      >
        <div className="mb-0.5 flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-60">
          {isBot && <AiMarker className="h-2.5 w-2.5" />}
          {message.sender_type === "vet" && <PersonMarker className="h-2.5 w-2.5" />}
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
