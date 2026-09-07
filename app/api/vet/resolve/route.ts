import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getVetIdFromRequest } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const vetId = await getVetIdFromRequest(req);
  if (!vetId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const conversationId: string | undefined = body?.conversationId;

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("conversations")
    .update({ status: "resolved" })
    .eq("id", conversationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
