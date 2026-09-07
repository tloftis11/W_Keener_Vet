import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const customerName: string | undefined = body?.customerName;
  const customerContact: string | undefined = body?.customerContact;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      customer_name: customerName ?? null,
      customer_contact: customerContact ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create conversation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}
