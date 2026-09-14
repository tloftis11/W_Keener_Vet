import { NextRequest, NextResponse } from "next/server";
import { geocode, searchNearbyVets } from "@/lib/geo/geoapify";

// Stateless — no Supabase involvement. The customer widget calls this once it
// has a location (from the browser or a typed city/zip), independent of the
// conversation's own message flow.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lat: number | undefined = body?.lat;
  const lon: number | undefined = body?.lon;
  const query: string | undefined = body?.query;
  const isEmergency: boolean = Boolean(body?.isEmergency);

  let origin: { lat: number; lon: number; label?: string };

  if (typeof lat === "number" && typeof lon === "number") {
    origin = { lat, lon };
  } else if (query && query.trim()) {
    const geocoded = await geocode(query.trim());
    if (!geocoded) {
      return NextResponse.json(
        { error: "Couldn't find that location — try a city name or zip code." },
        { status: 422 }
      );
    }
    origin = geocoded;
  } else {
    return NextResponse.json(
      { error: "Provide either lat/lon or a query" },
      { status: 400 }
    );
  }

  const results = await searchNearbyVets(origin, {
    // Wider than routine since ER-capable clinics are sparser.
    radiusMeters: isEmergency ? 30000 : 20000,
    preferEmergency: isEmergency,
  });

  return NextResponse.json({ results, origin });
}
