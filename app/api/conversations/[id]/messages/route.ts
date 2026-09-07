import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";
import { classifyConversation } from "@/lib/claude/classifier";
import { generateChatReply } from "@/lib/claude/chat";
import { getHardGateMessage, EMERGENCY_FOLLOW_UP_NOTE } from "@/lib/claude/acknowledgments";
import { getClassifierModel } from "@/lib/claude/models";
import type { Message } from "@/lib/supabase/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string | undefined = body?.text;

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: customerMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "customer",
      body: text.trim(),
    })
    .select("*")
    .single();

  if (insertError || !customerMessage) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to save message" },
      { status: 500 }
    );
  }

  const newMessages: Message[] = [customerMessage];

  // Once a conversation has been escalated or resolved, this becomes a
  // human-only channel — the customer can keep adding messages, but no
  // classifier or chat model call runs. A vet will see the new message
  // whenever they next open the thread.
  if (conversation.status !== "active") {
    return NextResponse.json({ messages: newMessages, status: conversation.status });
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("sender_type, body")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (historyError || !history) {
    return NextResponse.json(
      { error: historyError?.message ?? "Failed to load conversation history" },
      { status: 500 }
    );
  }

  const triage = await classifyConversation(history);

  if (triage.escalate) {
    const urgency = triage.urgency === "none" ? null : triage.urgency;
    // classifyConversation guarantees a real category whenever escalate is
    // true (falls back to "procedure" rather than "none" — see
    // classifier.ts), so this narrows the type without changing behavior.
    const category = triage.category === "none" ? "procedure" : triage.category;

    const { error: updateError } = await supabase
      .from("conversations")
      .update({ status: "escalated", urgency })
      .eq("id", conversationId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase.from("escalation_events").insert({
      conversation_id: conversationId,
      category,
      urgency,
      reason: triage.reason,
      classifier_model: getClassifierModel(),
      raw_output: triage,
    });

    // Medication and procedure are hard gates — the bot never generates
    // content on those topics, even partially. Emergency escalates the same
    // way, but the customer shouldn't be left waiting with nothing, so the
    // bot still responds (with urgent-care framing) alongside the hand-off.
    if (category === "emergency") {
      const replyText = await generateChatReply(history, { ...triage, category });
      const { data: botMessage, error: botError } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_type: "bot", body: replyText })
        .select("*")
        .single();

      if (botError || !botMessage) {
        return NextResponse.json(
          { error: botError?.message ?? "Failed to save bot reply" },
          { status: 500 }
        );
      }
      newMessages.push(botMessage);

      const { data: noteMessage } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_type: "system",
          body: EMERGENCY_FOLLOW_UP_NOTE,
        })
        .select("*")
        .single();
      if (noteMessage) newMessages.push(noteMessage);

      return NextResponse.json({ messages: newMessages, status: "escalated" });
    }

    const { data: ackMessage, error: ackError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_type: "system",
        body: getHardGateMessage(category),
      })
      .select("*")
      .single();

    if (ackError || !ackMessage) {
      return NextResponse.json(
        { error: ackError?.message ?? "Failed to save handoff message" },
        { status: 500 }
      );
    }

    newMessages.push(ackMessage);
    return NextResponse.json({ messages: newMessages, status: "escalated" });
  }

  const replyText = await generateChatReply(history);

  const { data: botMessage, error: botError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "bot",
      body: replyText,
    })
    .select("*")
    .single();

  if (botError || !botMessage) {
    return NextResponse.json(
      { error: botError?.message ?? "Failed to save bot reply" },
      { status: 500 }
    );
  }

  newMessages.push(botMessage);
  return NextResponse.json({ messages: newMessages, status: "active" });
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const since = req.nextUrl.searchParams.get("since");

  const supabase = getServiceClient();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("status, urgency, customer_name, customer_contact")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (since) {
    query = query.gt("created_at", since);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    messages,
    status: conversation.status,
    urgency: conversation.urgency,
    customerName: conversation.customer_name,
    customerContact: conversation.customer_contact,
  });
}
