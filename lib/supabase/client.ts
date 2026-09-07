"use client";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Anon-key client for the browser. Used only by the vet dashboard, which is
// authenticated via Supabase Auth — RLS restricts reads to the
// `authenticated` role. The customer widget never uses this; it talks to
// Next.js API routes instead (see lib/supabase/server.ts).
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function getBrowserClient() {
  if (cached) return cached;
  cached = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
