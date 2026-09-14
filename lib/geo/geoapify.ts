// Real vet-clinic search + geocoding via Geoapify. Still OpenStreetMap data
// underneath (same "nearby vet clinics from public map data" caveat as
// before — no reliable specialty tagging), but backed by Geoapify's own
// paid/free-tier infrastructure rather than the free public Overpass
// instance, which proved too unreliable under load (406s from a missing
// User-Agent, then 504 "server too busy" even on a bare direct request).
// Free tier is 3,000 credits/day — effectively unlimited at a single
// clinic's real traffic volume.
const API_BASE = "https://api.geoapify.com";

// Geoapify issues a separate key per API product, not one unified key.
function getGeocodingApiKey(): string {
  const key = process.env.GEOAPIFY_GEOCODING_API_KEY;
  if (!key) throw new Error("Missing GEOAPIFY_GEOCODING_API_KEY env var");
  return key;
}

function getPlacesApiKey(): string {
  const key = process.env.GEOAPIFY_PLACES_API_KEY;
  if (!key) throw new Error("Missing GEOAPIFY_PLACES_API_KEY env var");
  return key;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = new URL(`${API_BASE}/v1/geocode/search`);
  url.searchParams.set("text", query);
  // The clinic is US-based — without this, a bare zip code can resolve to a
  // same-numbered postal code in another country (confirmed during testing:
  // "43206" matched Reus, Spain, on the previous OSM geocoder).
  url.searchParams.set("filter", "countrycode:us");
  url.searchParams.set("limit", "1");
  url.searchParams.set("apiKey", getGeocodingApiKey());

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: Array<{ properties: { lat: number; lon: number; formatted: string } }>;
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  return {
    lat: feature.properties.lat,
    lon: feature.properties.lon,
    label: feature.properties.formatted,
  };
}

export interface VetResult {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  distanceKm: number;
  lat: number;
  lon: number;
  emergencyTagged: boolean;
}

interface GeoapifyFeature {
  properties: {
    place_id: string;
    name?: string;
    formatted?: string;
    lat: number;
    lon: number;
    distance?: number;
    datasource?: { raw?: Record<string, string> };
  };
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isEmergencyTagged(raw: Record<string, string> | undefined): boolean {
  if (!raw) return false;
  return raw.emergency === "yes" || (raw.opening_hours ?? "").includes("24/7");
}

export async function searchNearbyVets(
  origin: { lat: number; lon: number },
  opts: { radiusMeters?: number; preferEmergency?: boolean; limit?: number } = {}
): Promise<VetResult[]> {
  const radiusMeters = opts.radiusMeters ?? 20000;
  const limit = opts.limit ?? 5;

  const url = new URL(`${API_BASE}/v2/places`);
  url.searchParams.set("categories", "pet.veterinary");
  // Note: Geoapify's circle filter takes lon,lat (not lat,lon).
  url.searchParams.set("filter", `circle:${origin.lon},${origin.lat},${radiusMeters}`);
  url.searchParams.set("bias", `proximity:${origin.lon},${origin.lat}`);
  url.searchParams.set("limit", "20");
  url.searchParams.set("apiKey", getPlacesApiKey());

  let res: Response;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { features?: GeoapifyFeature[] };

  const results: VetResult[] = (data.features ?? [])
    .filter((f) => f.properties.name)
    .map((f) => {
      const p = f.properties;
      const raw = p.datasource?.raw;
      return {
        id: p.place_id,
        name: p.name!,
        address: p.formatted ?? null,
        phone: raw?.phone ?? raw?.["contact:phone"] ?? null,
        distanceKm:
          p.distance != null ? p.distance / 1000 : haversineKm(origin.lat, origin.lon, p.lat, p.lon),
        lat: p.lat,
        lon: p.lon,
        emergencyTagged: isEmergencyTagged(raw),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (opts.preferEmergency) {
    const emergencyOnly = results.filter((r) => r.emergencyTagged);
    if (emergencyOnly.length > 0) return emergencyOnly.slice(0, limit);
  }

  return results.slice(0, limit);
}
