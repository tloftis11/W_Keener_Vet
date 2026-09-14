"use client";

import { useState } from "react";
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

interface VetDetails {
  phone: string | null;
  website: string | null;
  hours: string | null;
  notes: string | null;
  sourceUrls: string[];
  usedWebSearch: boolean;
  emergencyCareConfirmed: "yes" | "no" | "unclear" | null;
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
  const [selectedVet, setSelectedVet] = useState<VetResult | null>(null);
  const [detail, setDetail] = useState<VetDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function handleSelectVet(vet: VetResult) {
    setSelectedVet(vet);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch("/api/vet-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: vet.id,
          name: vet.name,
          address: vet.address,
          isEmergency,
        }),
      });
      if (!res.ok) throw new Error("Couldn't load more details for this clinic.");
      setDetail(await res.json());
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDetailLoading(false);
    }
  }

  function handleBack() {
    setSelectedVet(null);
    setDetail(null);
    setDetailError(null);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-label={isEmergency ? "Nearest emergency vets" : "Nearby vet clinics"}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col bg-surface p-4 shadow-lg md:max-w-md lg:max-w-xl"
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
          {selectedVet ? (
            <div>
              <button
                onClick={handleBack}
                className="mb-3 text-xs text-ink-faint hover:text-ink hover:underline"
              >
                ← Back to results
              </button>
              <p className="font-medium text-ink">{selectedVet.name}</p>
              <p className="font-mono text-xs tabular-nums text-ink-faint">
                {kmToMiles(selectedVet.distanceKm).toFixed(1)} mi away
              </p>
              {selectedVet.address && (
                <p className="mt-1 text-sm text-ink-soft">{selectedVet.address}</p>
              )}

              {detailLoading && (
                <div className="mt-3 flex items-center gap-1 text-sm text-ink-soft">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent/60" />
                  <span className="ml-2">Looking up more details...</span>
                </div>
              )}

              {!detailLoading && detailError && (
                <p className="mt-3 text-sm text-red-600">{detailError}</p>
              )}

              {!detailLoading && !detailError && detail && isEmergency && (
                <>
                  {detail.emergencyCareConfirmed === "yes" && (
                    <div className="mt-3 rounded-md bg-accent-soft px-3 py-2 text-sm text-accent-dark">
                      ✓ Confirmed to offer 24-hour or emergency care.
                    </div>
                  )}
                  {detail.emergencyCareConfirmed === "no" && (
                    <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                      This location does not appear to offer emergency or after-hours
                      care. Call ahead or consider another option.
                    </div>
                  )}
                  {(detail.emergencyCareConfirmed === "unclear" ||
                    detail.emergencyCareConfirmed === null) && (
                    <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Emergency or 24-hour availability isn&apos;t confirmed. Call ahead
                      before heading here.
                    </div>
                  )}
                </>
              )}

              {!detailLoading && !detailError && detail && (
                <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                  {detail.phone && (
                    <p>
                      <a
                        href={`tel:${detail.phone}`}
                        className="text-accent hover:underline"
                      >
                        {detail.phone}
                      </a>
                    </p>
                  )}
                  {detail.website && (
                    <p>
                      <a
                        href={detail.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-accent hover:underline"
                      >
                        {detail.website}
                      </a>
                    </p>
                  )}
                  {detail.hours && <p className="text-ink-soft">Hours: {detail.hours}</p>}
                  {detail.notes && <p className="text-ink-soft">{detail.notes}</p>}
                  {!detail.phone && !detail.website && !detail.hours && !detail.notes && (
                    <p className="italic text-ink-faint">
                      No additional details found for this clinic.
                    </p>
                  )}

                  {detail.usedWebSearch && detail.sourceUrls.length > 0 && (
                    <div className="mt-2 border-t border-line pt-2 text-[11px] text-ink-faint">
                      <p className="mb-1">Found via web search:</p>
                      <ul className="space-y-0.5">
                        {detail.sourceUrls.map((url) => (
                          <li key={url}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-all hover:underline"
                            >
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {needsLocation && !loading && (
                <div className="space-y-2">
                  <p className="text-sm text-ink-soft">
                    We couldn&apos;t get your location automatically. What city or zip
                    code are you in?
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
                  No vet clinics turned up in public map data near you. Try calling
                  directory assistance, or searching online for &ldquo;
                  {isEmergency ? "emergency vet" : "vet"} near me.&rdquo;
                </p>
              )}

              {!needsLocation && !loading && !error && results && results.length > 0 && (
                <ul className="space-y-3">
                  {results.map((vet) => (
                    <li
                      key={vet.id}
                      onClick={() => handleSelectVet(vet)}
                      className="cursor-pointer rounded-md border border-line p-3 hover:bg-accent-soft/40"
                    >
                      <p className="font-medium text-ink">{vet.name}</p>
                      <p className="font-mono text-xs tabular-nums text-ink-faint">
                        {kmToMiles(vet.distanceKm).toFixed(1)} mi away
                      </p>
                      {vet.address && (
                        <p className="mt-1 text-sm text-ink-soft">{vet.address}</p>
                      )}
                      {vet.phone && (
                        <a
                          href={`tel:${vet.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-block text-sm text-accent hover:underline"
                        >
                          {vet.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <p className="border-t border-line pt-3 text-[11px] italic text-ink-faint">
          From public map data (OpenStreetMap). Please call ahead to confirm hours and
          availability.
        </p>
      </div>
    </div>
  );
}
