import { NextRequest, NextResponse } from "next/server";
import { getPlaceDetails } from "@/lib/geo/geoapify";
import { searchWeb } from "@/lib/search/tavily";
import { summarizeVetInfo } from "@/lib/claude/vetSummary";

// Called when a customer clicks into a specific nearby-vet result. Geoapify
// Place Details is always tried first (same structured OSM data, just more
// of it — zero hallucination risk since nothing is model-generated). A web
// search + grounded LLM summary only runs as a fallback when that structured
// data is too thin (no phone and no website) to be useful on its own.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const placeId: string | undefined = body?.placeId;
  const name: string | undefined = body?.name;
  const address: string | undefined = body?.address;

  if (!placeId || !name) {
    return NextResponse.json({ error: "placeId and name are required" }, { status: 400 });
  }

  const details = await getPlaceDetails(placeId);
  const isThin = !details.phone && !details.website;

  let phone = details.phone;
  let website = details.website;
  let hours = details.hours;
  let notes: string | null = details.description;
  let sourceUrls: string[] = [];
  let usedWebSearch = false;

  if (isThin) {
    const searchResults = await searchWeb(`${name} ${address ?? ""} veterinary clinic`.trim());
    if (searchResults.length > 0) {
      const summary = await summarizeVetInfo({ name, address: address ?? null }, searchResults);
      if (summary.confident) {
        usedWebSearch = true;
        phone = phone ?? summary.phone;
        website = website ?? summary.website;
        hours = hours ?? summary.hours;
        notes = notes ?? summary.notes;
        sourceUrls = summary.sourceUrls;
      }
    }
  }

  return NextResponse.json({ phone, website, hours, notes, sourceUrls, usedWebSearch });
}
