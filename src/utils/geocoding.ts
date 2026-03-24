const LOCATIONIQ_API_KEY = import.meta.env.VITE_LOCATIONIQ_API_KEY || "";
const LOCATIONIQ_BASE = "https://us1.locationiq.com/v1";

export interface GeocodingResult {
  display_name: string;
  lat: number;
  lon: number;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export interface AutocompleteResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

let autocompleteTimer: ReturnType<typeof setTimeout> | null = null;

export function isGeocodingConfigured(): boolean {
  return LOCATIONIQ_API_KEY.length > 0;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!LOCATIONIQ_API_KEY || !address.trim()) return null;

  try {
    const params = new URLSearchParams({
      key: LOCATIONIQ_API_KEY,
      q: address,
      format: "json",
      countrycodes: "it",
      limit: "1",
      addressdetails: "1",
    });

    const response = await fetch(`${LOCATIONIQ_BASE}/search?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const result = data[0];
    return {
      display_name: result.display_name,
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      address: result.address || {},
    };
  } catch {
    return null;
  }
}

export async function autocompleteAddress(
  query: string,
  signal?: AbortSignal
): Promise<AutocompleteResult[]> {
  if (!LOCATIONIQ_API_KEY || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      key: LOCATIONIQ_API_KEY,
      q: query,
      format: "json",
      countrycodes: "it",
      limit: "5",
      dedupe: "1",
    });

    const response = await fetch(`${LOCATIONIQ_BASE}/autocomplete?${params}`, { signal });
    if (!response.ok) return [];

    const data = await response.json();
    return (data || []).map((item: any) => ({
      place_id: item.place_id,
      display_name: item.display_name,
      lat: item.lat,
      lon: item.lon,
    }));
  } catch {
    return [];
  }
}

export function debouncedAutocomplete(
  query: string,
  callback: (results: AutocompleteResult[]) => void,
  delay = 400
): () => void {
  if (autocompleteTimer) clearTimeout(autocompleteTimer);

  const controller = new AbortController();

  autocompleteTimer = setTimeout(async () => {
    const results = await autocompleteAddress(query, controller.signal);
    callback(results);
  }, delay);

  return () => {
    if (autocompleteTimer) clearTimeout(autocompleteTimer);
    controller.abort();
  };
}
