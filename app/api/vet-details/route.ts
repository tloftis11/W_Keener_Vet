import { NextRequest, NextResponse } from "next/server";
import { getPlaceDetails } from "@/lib/geo/geoapify";
import { searchWeb } from "@/lib/search/tavily";
import { summarizeVetInfo } from "@/lib/claude/vetSummary";

// Called when a customer clicks into a specific nearby-vet result. Geoapify
// Place Details is always tried first (same structured OSM data, just more
// of it — zero hallucination risk since nothing is model-generated).
//
// A web search + grounded LLM summary runs as a fallback when that
// structured data is too thin (no phone and no website) to be useful on its
// own — OR, regardless of how much contact info is already known, whenever
// this is an emergency lookup, since "do they actually offer 24-hour/
// emergency care" is a different question than "do we have their phone
// number," and the OSM-derived list can (and does) surface ordinary
// daytime clinics when no emergency-tagged ones are nearby.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const placeId: string | undefined = body?.placeId;
  const name: string | undefined = body?.name;
  const address: string | undefined = body?.address;
  const isEmergency: boolean = Boolean(body?.isEmergency);

  if (!placeId || !name) {
    return NextResponse.json({ error: "placeId and name are required" }, { status: 400 });
  }

  const details = await getPlaceDetails(placeId);
  const contactIsThin = !details.phone && !details.website;
  const shouldSearch = contactIsThin || isEmergency;

  let phone = details.phone;
  let website = details.website;
  let hours = details.hours;
  let notes: string | null = details.description;
  let sourceUrls: string[] = [];
  let usedWebSearch = false;
  let emergencyCareConfirmed: "yes" | "no" | "unclear" | null = null;

  if (shouldSearch) {
    const query = isEmergency
      ? `${name} ${address ?? ""} emergency veterinary 24 hour after hours care`.trim()
      : `${name} ${address ?? ""} veterinary clinic`.trim();

    const searchResults = await searchWeb(query);
    if (searchResults.length > 0) {
      const summary = await summarizeVetInfo(
        { name, address: address ?? null },
        searchResults,
        { isEmergency }
      );
      if (summary.confident) {
        usedWebSearch = true;
        phone = phone ?? summary.phone;
        website = website ?? summary.website;
        hours = hours ?? summary.hours;
        notes = notes ?? summary.notes;
        sourceUrls = summary.sourceUrls;
        emergencyCareConfirmed = summary.emergencyCareConfirmed;
      }
    }
    // Searched but couldn't confirm either way (no results, or the LLM
    // wasn't confident it found the right business) — still worth telling
    // the customer emergency care isn't confirmed, rather than saying nothing.
    if (isEmergency && emergencyCareConfirmed === null) {
      emergencyCareConfirmed = "unclear";
    }
  }

  return NextResponse.json({
    phone,
    website,
    hours,
    notes,
    sourceUrls,
    usedWebSearch,
    emergencyCareConfirmed,
  });
}
