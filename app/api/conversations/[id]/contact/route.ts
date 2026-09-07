import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Collected specifically at the point of escalation — a vet may need to
// reach the customer directly rather than wait on them to come back to the
// chat, so this is the one piece of PII the app asks for beyond the
// conversation itself.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const body = await req.json().catch(() => ({}));
  const name: string | undefined = body?.name?.trim();
  const contact: string | undefined = body?.contact?.trim();

  if (!name && !contact) {
    return NextResponse.json(
      { error: "At least a name or contact value is required" },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();
  const update: { customer_name?: string; customer_contact?: string } = {};
  if (name) update.customer_name = name;
  if (contact) update.customer_contact = contact;

  const { error } = await supabase
    .from("conversations")
    .update(update)
    .eq("id", conversationId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
