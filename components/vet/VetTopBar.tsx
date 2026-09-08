"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import PawMark from "@/components/PawMark";
import { getBrowserClient } from "@/lib/supabase/client";

export default function VetTopBar() {
  const router = useRouter();

  async function handleSignOut() {
    await getBrowserClient().auth.signOut();
    router.push("/vet/login");
  }

  return (
    <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6">
      <Link href="/vet/dashboard" className="flex items-center gap-2">
        <PawMark className="h-5 w-5 text-accent" />
        <span className="font-display text-base font-semibold text-ink">
          W. Keener Veterinary
        </span>
      </Link>
      <button
        onClick={handleSignOut}
        className="text-xs font-medium text-ink-soft hover:text-ink hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}
