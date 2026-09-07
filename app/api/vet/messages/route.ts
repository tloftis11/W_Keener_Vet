import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getVetIdFromRequest } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const vetId = await getVetIdFromRequest(req);
  if (!vetId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;
  const text: string | undefined = body?.text;

  if (!conversationId || !text || !text.trim()) {
    return NextResponse.json(
      { error: "conversationId and text are required" },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "vet",
      sender_id: vetId,
      body: text.trim(),
    })
    .select("*")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to save reply" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message });
}
