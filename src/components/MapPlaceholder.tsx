import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { MapLegend } from "./MapLegend";
import {
  laundryLocations,
  houseClients,
  helpers,
  vehicles,
} from "../utils/constants";
import {
  createTopDownVehicleSvg,
  haversineDistanceKm,
  MarkerWithElement,
} from "../utils/helpers";

// Helper functions for markers SVG (local to this component as they are only used here for markers)
const createLaundrySvg = () =>
  '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 11L12 7.5 16 9.3 20 7.5 23.5 11 21.5 12.8 20.6 12.2V24H11.4V12.2L8.5 11z" fill="#C4B5FD" stroke="#7C3AED" stroke-width="1.1" stroke-linejoin="round" /><path d="M12 7.5c0.5 0.7 1.3 1.2 2 1.2s1.5-0.5 2-1.2" fill="none" stroke="#4C1D95" stroke-width="0.9" stroke-linecap="round" /></svg>';

const createHouseSvg = () =>
  '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="6,16 16,6 26,16 26,26 6,26" fill="#020617" /><polygon points="8,16 16,8 24,16 24,24 8,24" fill="#FBBF24" /><rect x="14" y="18" width="4" height="6" fill="#020617" /></svg>';

const createHelperSvg = () =>
  '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="11" r="4" fill="#22C55E" /><path d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#22C55E"/><path d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#111827" stroke-width="1.5" stroke-linecap="round" /></svg>';

const createVehicleSvg = () => createTopDownVehicleSvg("#3B82F6");

async function fetchRoute(
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

// Re-implement animateMarkerAlongRoute locally or import if shared. 
// Since it was inside App.tsx but used inside MapPlaceholder, we need it here.
// But wait, it was defined in App.tsx scope.
// Let's implement it here as it seems to be only used for the random movement in MapPlaceholder.
// Actually, `runOrderSimulation` in App.tsx ALSO uses `animateMarkerAlongRoute` and `fetchRoute`.
// So we should move `animateMarkerAlongRoute` and `fetchRoute` to `helpers.ts` as well.
// But `animateMarkerAlongRoute` depends on `mapboxgl`.
// Let's keep it here for now or duplicate/move.
// To be clean, I should move `fetchRoute` and `animateMarkerAlongRoute` to `helpers.ts` or a new `mapUtils.ts`.
// For now, I will include `animateMarkerAlongRoute` here to make this component self-contained for the "roaming" logic.
// However, `App.tsx` passes `map` instance to `runOrderSimulation`.
// `MapPlaceholder` initiates the map.

function animateMarkerAlongRoute(
  map: mapboxgl.Map,
  marker: mapboxgl.Marker,
  coordinates: [number, number][],
  options: {
    durationMs: number;
    phase: "Inbound" | "Processing" | "Outbound" | "Completed";
    carId: string;
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
            // Speed calculation is rough estimation
             const speedKmh = 40; 
             options.onTelemetry({
                carId: options.carId,
                lat,
                lng,
                speedKmh,
                phase: options.phase,
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

export function MapPlaceholder(props: {
  lockedPlanLabel?: string | null;
  onSimulationReady?: (value: {
    map: mapboxgl.Map;
    laundryMarkers: MarkerWithElement[];
    houseMarkers: MarkerWithElement[];
    helperMarkers: MarkerWithElement[];
    vehicleMarkers: MarkerWithElement[];
  }) => void;
  onLaundryGeofenceEnter?: (laundryId: string) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!import.meta.env.VITE_MAPBOX_TOKEN) {
      return;
    }

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN as string;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-122.0838, 37.3861],
      zoom: 13.5,
    });

    const laundryMarkers: MarkerWithElement[] = [];
    const houseMarkers: MarkerWithElement[] = [];
    const helperMarkers: MarkerWithElement[] = [];
    const vehicleMarkers: MarkerWithElement[] = [];
    let destroyed = false;

    map.on("remove", () => {
      destroyed = true;
    });

    const handleResize = () => {
      map.resize();
    };

    window.addEventListener("resize", handleResize);

    map.on("load", () => {
      laundryLocations.forEach((location) => {
        const wrapper = document.createElement("div");
        const element = document.createElement("div");
        element.className = "laundry-marker-dot";
        wrapper.appendChild(element);

        const marker = new mapboxgl.Marker({
          element: wrapper,
          anchor: "center",
        })
          .setLngLat(location.coordinates)
          .addTo(map);

        laundryMarkers.push({ marker, element, id: location.id });
      });

      houseClients.forEach((client) => {
        const wrapper = document.createElement("div");
        const element = document.createElement("div");
        element.className = "house-marker-dot";
        wrapper.appendChild(element);

        const marker = new mapboxgl.Marker({
          element: wrapper,
          anchor: "bottom",
          offset: [0, 0],
        })
          .setLngLat(client.coordinates)
          .addTo(map);

        houseMarkers.push({ marker, element, id: client.id });
      });

      helpers.forEach((helper) => {
        const wrapper = document.createElement("div");
        const element = document.createElement("div");
        element.className = "helper-marker-dot";
        wrapper.appendChild(element);

        const marker = new mapboxgl.Marker({
          element: wrapper,
          anchor: "bottom",
          offset: [0, 0],
        })
          .setLngLat(helper.coordinates)
          .addTo(map);

        helperMarkers.push({ marker, element, id: helper.id });
      });

      vehicles.forEach((vehicle) => {
        const wrapper = document.createElement("div");
        const element = document.createElement("div");
        element.className = "vehicle-marker-svg";
        element.innerHTML = createTopDownVehicleSvg("#3B82F6");
        wrapper.appendChild(element);

        const marker = new mapboxgl.Marker({
          element: wrapper,
          anchor: "bottom",
          offset: [0, 0],
        })
          .setLngLat(vehicle.coordinates)
          .addTo(map);

        vehicleMarkers.push({ marker, element, id: vehicle.id });
      });

      const updateMarkerStyles = () => {
        laundryMarkers.forEach(({ element }) => {
          element.className = "laundry-marker-svg";
          element.innerHTML = createLaundrySvg();
        });

        houseMarkers.forEach(({ element }) => {
          element.className = "house-marker-svg";
          element.innerHTML = createHouseSvg();
        });

        helperMarkers.forEach(({ element }) => {
          element.className = "helper-marker-svg";
          element.innerHTML = createHelperSvg();
        });

        vehicleMarkers.forEach(({ element }) => {
          element.className = "vehicle-marker-svg";
          element.innerHTML = createVehicleSvg();
        });
      };

      updateMarkerStyles();

      map.on("zoom", () => {
        updateMarkerStyles();
      });

      const roamingTargets: [number, number][] = [
        ...laundryLocations.map((location) => location.coordinates),
        ...houseClients.map((client) => client.coordinates),
      ];

      vehicleMarkers.forEach(({ marker, element, id }) => {
        void (async () => {
          let current: [number, number] = marker.getLngLat().toArray() as [number, number];

          while (!destroyed) {
            const target =
              roamingTargets[Math.floor(Math.random() * roamingTargets.length)] ??
              current;

            const route = await fetchRoute(mapboxToken, [current, target]);

            if (destroyed) {
              return;
            }

            if (!route.length) {
              continue;
            }

            const durationMs = 22000 + Math.random() * 12000;

            await animateMarkerAlongRoute(map, marker, route, {
              durationMs,
              phase: "Inbound",
              carId: id,
              headingElement: element,
            });

            if (destroyed) {
              return;
            }

            const last = route[route.length - 1];
            current = [last[0], last[1]];
          }
        })();
      });

      if (props.onLaundryGeofenceEnter) {
        let triggered = false;
        const radiusMeters = 80;
        const checkGeofence = () => {
          if (destroyed || triggered) {
            return;
          }
          vehicleMarkers.forEach(({ marker }) => {
            const position = marker.getLngLat();
            const vehicleCoord: [number, number] = [position.lng, position.lat];
            laundryLocations.forEach((location) => {
              const distanceM =
                haversineDistanceKm(vehicleCoord, location.coordinates) * 1000;
              if (!triggered && distanceM < radiusMeters) {
                triggered = true;
                props.onLaundryGeofenceEnter?.(location.id);
              }
            });
          });
          if (!destroyed && !triggered) {
            window.requestAnimationFrame(checkGeofence);
          }
        };
        window.requestAnimationFrame(checkGeofence);
      }

      if (props.onSimulationReady) {
        props.onSimulationReady({
          map,
          laundryMarkers,
          houseMarkers,
          helperMarkers,
          vehicleMarkers,
        });
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
    };
  }, []);

  return (
    <section className="relative h-full w-full rounded-3xl overflow-hidden border border-slate-700/60 bg-slate-900/70 backdrop-blur-2xl shadow-glass">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.18),transparent_45%)] opacity-80" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.6)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="relative h-full flex flex-col justify-between">
        <div className="flex items-start justify-between px-4 sm:px-6 pt-4">
          <div>
            <p className="text-[0.65rem] sm:text-xs tracking-[0.3em] text-slate-200/90 uppercase">
              MAPBOX LAYER
            </p>
            <p className="mt-1 text-sm sm:text-base font-semibold text-slate-50">
              Sylphold Geospatial Telemetry
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1 text-[0.6rem] sm:text-[0.7rem] text-slate-100 tracking-[0.18em] uppercase border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
              Mapbox Ready
            </span>
            <span className="text-[0.6rem] text-slate-300/80 tracking-[0.18em] uppercase">
              Attach mapbox-gl instance to this container
            </span>
          </div>
        </div>
        <div className="relative flex-1 px-3 sm:px-5 pb-4 sm:pb-6 flex items-center justify-center">
          <div className="h-full w-full rounded-2xl border border-slate-200/20 bg-slate-900/20 overflow-hidden">
            <div ref={mapContainerRef} className="h-full w-full" />
          </div>
          {props.lockedPlanLabel ? (
            <div className="pointer-events-none absolute top-3 right-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/70 bg-emerald-500/15 px-3 py-1 text-[0.6rem] sm:text-[0.65rem] tracking-[0.22em] uppercase text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.5)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              <span>{props.lockedPlanLabel}</span>
            </div>
          ) : null}
          <MapLegend />
        </div>
      </div>
    </section>
  );
}
