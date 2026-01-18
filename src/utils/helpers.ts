import mapboxgl from "mapbox-gl";
import { Order, OrderStatus } from "./constants";

export type MarkerWithElement = {
  marker: mapboxgl.Marker;
  element: HTMLDivElement;
  id: string;
};

export function haversineDistanceKm(a: [number, number], b: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export function createTopDownVehicleSvg(color: string) {
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="6" width="12" height="20" rx="3" fill="${color}" /><rect x="11" y="10" width="10" height="8" rx="2" fill="#E5E7EB" /><circle cx="11" cy="9" r="2" fill="#F9FAFB" /><circle cx="21" cy="9" r="2" fill="#F9FAFB" /><circle cx="11" cy="23" r="2" fill="#F9FAFB" /><circle cx="21" cy="23" r="2" fill="#F9FAFB" /></svg>`;
}

export function createTransferringAssetsSvg() {
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="20" height="12" rx="3" fill="#020617" /><rect x="8" y="12" width="7" height="8" rx="1.5" fill="#38BDF8" /><rect x="17" y="12" width="7" height="8" rx="1.5" fill="#F97316" /><path d="M13 16h6" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round"/><path d="M12 14l-2 2 2 2" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 14l2 2-2 2" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function createRandomInRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0 || max < min) {
    return 1000;
  }
  const value = min + Math.random() * (max - min);
  if (!Number.isFinite(value) || value <= 0) {
    return 1000;
  }
  return value;
}

export function computeLaundryLoad(laundryId: string, currentOrders: Order[]) {
  const active = currentOrders.filter((order) => order.status !== "Completed");
  if (active.length === 0) {
    return 0.35;
  }
  const matching = active.filter((order) => order.laundryId === laundryId);
  const ratio = matching.length / active.length;
  const value = ratio + 0.2;
  return Math.max(0, Math.min(1, value));
}

export function computeHelperLoad(helperId: string, currentOrders: Order[]) {
  const active = currentOrders.filter(
    (order) => order.status !== "Completed" && order.helperId
  );
  if (active.length === 0) {
    return 0.35;
  }
  const matching = active.filter((order) => order.helperId === helperId);
  const ratio = matching.length / active.length;
  const value = ratio + 0.15;
  return Math.max(0, Math.min(1, value));
}

export function formatStarRating(rating: number) {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  let stars = "";
  for (let index = 0; index < 5; index += 1) {
    stars += index < clamped ? "★" : "☆";
  }
  return stars;
}

export async function fetchRoute(
  mapboxToken: string,
  coordinates: [number, number][]
): Promise<[number, number][]> {
  const coordsString = coordinates.map((c) => c.join(",")).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&access_token=${mapboxToken}`;

  try {
    const response = await fetch(url);
    const json = await response.json();
    if (json.routes && json.routes.length > 0) {
      return json.routes[0].geometry.coordinates;
    }
  } catch (error) {
    console.error("Error fetching route:", error);
  }
  return [];
}

export function animateMarkerAlongRoute(
  map: mapboxgl.Map,
  marker: mapboxgl.Marker,
  coordinates: [number, number][],
  options: {
    durationMs: number;
    phase?: "Inbound" | "Processing" | "Outbound" | "Completed";
    carId?: string;
    onTelemetry?: (snapshot: any) => void;
    headingElement?: HTMLElement;
  }
): Promise<void> {
  return new Promise((resolve) => {
    let start: number | null = null;
    const pathLength = coordinates.length;

    const frame = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / options.durationMs);

      const index = Math.floor(progress * (pathLength - 1));
      const nextIndex = Math.min(pathLength - 1, index + 1);
      const p1 = coordinates[index];
      const p2 = coordinates[nextIndex];

      if (p1 && p2) {
        const segmentProgress = (progress * (pathLength - 1)) % 1;
        const lng = p1[0] + (p2[0] - p1[0]) * segmentProgress;
        const lat = p1[1] + (p2[1] - p1[1]) * segmentProgress;
        marker.setLngLat([lng, lat]);

        if (options.headingElement) {
          const angle = (Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) * 180) / Math.PI;
          options.headingElement.style.transform = `rotate(${angle}deg)`;
        }

        if (options.onTelemetry) {
           const speedKmh = 40; 
           options.onTelemetry({
             carId: options.carId,
             lat,
             lng,
             speedKmh,
             heading: 0,
             battery: 100,
             status: options.phase || "Active"
           });
        }
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(frame);
  });
}
