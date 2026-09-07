import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "./types";

// Server-only client using the service-role key. Bypasses RLS entirely, so
// this must never be imported into client components or exposed to the
// browser. All writes to conversations/messages/escalation_events go through
// this client from API routes.
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getServiceClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  cached = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// Verifies the bearer token attached by the vet dashboard and returns the
// authenticated vet's user id, or null if the request isn't from a logged-in
// vet. All vet-only writes (replies, resolving) go through this check since
// there is no RLS insert policy allowing the browser to write directly.
export async function getVetIdFromRequest(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await getServiceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
