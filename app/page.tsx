import ChatWidget from "@/components/ChatWidget";
import PawMark from "@/components/PawMark";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-4">
          <PawMark className="h-6 w-6 text-accent" />
          <span className="font-display text-lg font-semibold text-ink">
            W. Keener Veterinary
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4">
        <div className="min-h-0 flex-1 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <ChatWidget />
        </div>
      </main>
    </div>
  );
}
