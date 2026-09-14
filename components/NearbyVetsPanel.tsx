"use client";

import type { VetResult } from "@/lib/geo/geoapify";

interface NearbyVetsPanelProps {
  onClose: () => void;
  loading: boolean;
  error: string | null;
  results: VetResult[] | null;
  isEmergency: boolean;
  needsLocation: boolean;
  locationValue: string;
  onLocationChange: (value: string) => void;
  onLocationSubmit: () => void;
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

export default function NearbyVetsPanel({
  onClose,
  loading,
  error,
  results,
  isEmergency,
  needsLocation,
  locationValue,
  onLocationChange,
  onLocationSubmit,
}: NearbyVetsPanelProps) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label={isEmergency ? "Nearest emergency vets" : "Nearby vet clinics"}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-surface p-4 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="font-display text-lg text-ink">
            {isEmergency ? "Nearest emergency vets" : "Nearby vet clinics"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-faint hover:bg-accent-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {needsLocation && !loading && (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">
                We couldn&apos;t get your location automatically. What city or zip code
                are you in?
              </p>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder="City or zip code"
                  aria-label="City or zip code"
                  value={locationValue}
                  onChange={(e) => onLocationChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onLocationSubmit();
                  }}
                />
                <button
                  onClick={onLocationSubmit}
                  disabled={!locationValue.trim()}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-40"
                >
                  Search
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-1 py-4 text-sm text-ink-soft">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60" />
              <span className="ml-2">Searching nearby...</span>
            </div>
          )}

          {!needsLocation && !loading && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {!needsLocation && !loading && !error && results?.length === 0 && (
            <p className="text-sm text-ink-soft">
              No vet clinics turned up in public map data near you. Try calling directory
              assistance, or searching online for &ldquo;
              {isEmergency ? "emergency vet" : "vet"} near me.&rdquo;
            </p>
          )}

          {!needsLocation && !loading && !error && results && results.length > 0 && (
            <ul className="space-y-3">
              {results.map((vet) => (
                <li key={vet.id} className="rounded-md border border-line p-3">
                  <p className="font-medium text-ink">{vet.name}</p>
                  <p className="text-xs text-ink-faint">
                    {kmToMiles(vet.distanceKm).toFixed(1)} mi away
                  </p>
                  {vet.address && (
                    <p className="mt-1 text-sm text-ink-soft">{vet.address}</p>
                  )}
                  {vet.phone && (
                    <a
                      href={`tel:${vet.phone}`}
                      className="mt-1 inline-block text-sm text-accent hover:underline"
                    >
                      {vet.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-line pt-3 text-[11px] italic text-ink-faint">
          From public map data (OpenStreetMap) — please call ahead to confirm hours and
          availability.
        </p>
      </div>
    </div>
  );
}
