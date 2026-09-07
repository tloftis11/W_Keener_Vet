import ChatWidget from "@/components/ChatWidget";
import PawMark from "@/components/PawMark";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="flex items-center gap-2 px-4 py-4 sm:px-6">
          <PawMark className="h-6 w-6 shrink-0 text-accent" />
          <span className="font-display text-lg font-semibold text-ink">
            W. Keener Veterinary
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-2 py-3 sm:px-4 sm:py-4">
        <div className="min-h-0 flex-1 rounded-2xl border border-line bg-surface p-3 shadow-sm sm:p-4">
          <ChatWidget />
        </div>
      </main>
    </div>
  );
}
