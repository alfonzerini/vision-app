import "server-only";

export interface GeoResult {
  latitude: number;
  longitude: number;
}

/**
 * Look up the coordinates of a UK postcode via postcodes.io (free, no API key).
 * Returns null if the postcode isn't found or the service is unreachable —
 * callers should treat geocoding as best-effort (the job is still created; it
 * just won't appear in distance-based search until coordinates exist).
 */
export async function geocodePostcode(
  postcode: string,
): Promise<GeoResult | null> {
  const pc = postcode?.trim();
  if (!pc) return null;
  try {
    const res = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      result?: { latitude?: number; longitude?: number };
    };
    const r = json.result;
    if (typeof r?.latitude === "number" && typeof r?.longitude === "number") {
      return { latitude: r.latitude, longitude: r.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
