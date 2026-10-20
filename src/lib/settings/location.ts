import "server-only";

type Point = { latitude: number; longitude: number };
let zips: Record<string, Point> | undefined;

/**
 * The approximate center of a US ZIP code area (US Census ZIP Code
 * Tabulation Areas, via the us-zips package), or null if it isn't known.
 * Rounded to about a kilometer: it's only used to measure distance.
 */
export async function locateZip(
  zip: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  zips ??= ((await import("us-zips")) as { default: Record<string, Point> })
    .default;
  const p = zips[zip];
  if (!p) return null;
  return {
    lat: Math.round(p.latitude * 100) / 100,
    lng: Math.round(p.longitude * 100) / 100,
  };
}
