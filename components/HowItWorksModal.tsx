"use client";

export default function HowItWorksModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label="How VetAI works"
        className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-display text-lg text-ink">How VetAI works</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-faint hover:bg-accent-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 pt-4 text-sm text-ink-soft">
          <p>
            <strong className="font-medium text-ink">
              VetAI is a demo — it&apos;s not real veterinary medicine.
            </strong>{" "}
            Nothing here should be used to make actual decisions about a pet&apos;s health.
          </p>

          <div>
            <p className="font-medium text-ink">What it answers directly</p>
            <p>
              General pet-care and symptom questions, clinic-style logistics — it engages
              rather than deflecting, and asks follow-up questions when it needs more
              information.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">What it hands off to a vet</p>
            <p>
              Anything involving <strong className="text-ink">medication or dosing</strong>,{" "}
              <strong className="text-ink">procedures</strong>, or a possible{" "}
              <strong className="text-ink">emergency</strong> — those are flagged by a
              separate classifier step, not decided by the same model that&apos;s
              chatting with you. Medication/procedure conversations stop there and wait
              for a vet; emergencies still get an immediate, practical response while
              also being flagged.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">Nearby vet clinics</p>
            <p>
              When something is flagged, the app also looks up real nearby clinics (and,
              for emergencies, tries to confirm whether they actually offer 24-hour
              care) — sourced live from public map data and, when needed, a grounded web
              search, never invented by the model.
            </p>
          </div>

          <div>
            <p className="font-medium text-ink">Reply style</p>
            <p>
              Detailed gives fuller explanations; Simple keeps answers short and plain —
              switch anytime above the chat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
