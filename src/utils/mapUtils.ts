import mapboxgl from "mapbox-gl";
import {
  laundryLocations,
  houseClients,
  helpers,
  vehicles,
  Order,
  RoutingEngineState,
  FollowMode,
  TelemetrySnapshot,
  PlanId,
} from "./constants";
import { haversineDistanceKm, createTopDownVehicleSvg, fetchRoute } from "./helpers";
import { routeLengthKm } from "./businessLogic";

export function createOrUpdateRouteSource(
  map: mapboxgl.Map,
  id: string,
  coordinates: [number, number][]
) {
  const existingSource = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;

  const data = {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
    properties: {},
  };

  if (existingSource) {
    existingSource.setData(data);
    return;
  }

  map.addSource(id, {
    type: "geojson",
    data,
    lineMetrics: true,
  });
}

let lastMissionCarMarker: mapboxgl.Marker | null = null;

export async function runOrderSimulation(
  map: mapboxgl.Map,
  mapboxToken: string,
  markers: {
    carAStart: [number, number];
    carBStart: [number, number];
    helperCoord: [number, number];
    clientCoord: [number, number];
    laundryCoord: [number, number];
    helperHomeCoord?: [number, number];
    laundryElement: HTMLDivElement | null;
    helperElement: HTMLDivElement | null;
    clientElement: HTMLDivElement | null;
    onHelperPickup?: () => void;
  },
  onTelemetry?: (snapshot: TelemetrySnapshot) => void,
  showRoutes?: boolean,
  plan?: PlanId,
  laundryFailure?: boolean
) {
  const pathACoords = await fetchRoute(mapboxToken, [
    markers.carAStart,
    markers.helperCoord,
    markers.laundryCoord,
  ]);
  const pathBCoords = await fetchRoute(mapboxToken, [
    markers.carBStart,
    markers.clientCoord,
    markers.laundryCoord,
  ]);
  const pathCCoords = await fetchRoute(
    mapboxToken,
    plan === "Eco" && markers.helperHomeCoord
      ? [markers.laundryCoord, markers.clientCoord, markers.helperHomeCoord]
      : [markers.laundryCoord, markers.clientCoord]
  );

  if (pathACoords.length === 0 || pathBCoords.length === 0 || pathCCoords.length === 0) {
    return;
  }

  if (!(plan === "Eco" && markers.helperHomeCoord)) {
    pathCCoords[pathCCoords.length - 1] = markers.clientCoord;
  }

  const bounds = new mapboxgl.LngLatBounds();
  [markers.carAStart, markers.carBStart, markers.helperCoord, markers.clientCoord].forEach(
    (point) => bounds.extend(point)
  );
  map.fitBounds(bounds, { padding: 80, duration: 1200 });
  let followHandler: ((lng: number, lat: number) => void) | null = null;
  if (plan === "Premium" || plan === "Eco" || plan === "Flash") {
    const bufferedAlpha =
      plan === "Flash" ? 0.32 : plan === "Premium" ? 0.22 : 0.2;
    followHandler = createCameraFollowHandler(map, bounds, "buffered", {
      bufferedAlpha,
    });
  }
  if (showRoutes !== false) {
    createOrUpdateRouteSource(map, "routeA", pathACoords);
    createOrUpdateRouteSource(map, "routeB", pathBCoords);
    createOrUpdateRouteSource(map, "routeC", pathCCoords);

    ensureRouteLayer(map, "routeA", []);
    ensureRouteLayer(map, "routeB", ["routeA"]);
    ensureRouteLayer(map, "routeC", ["routeA", "routeB"]);
  }

  const carA = createCarMarkerElement();
  const carB = createCarMarkerElement();
  const carC = createCarMarkerElement();

  carA.element.innerHTML = createTopDownVehicleSvg("#EF4444");
  carB.element.innerHTML = createTopDownVehicleSvg("#EF4444");
  carC.element.innerHTML = createTopDownVehicleSvg("#EF4444");

  const carAMarker = new mapboxgl.Marker({ element: carA.wrapper, anchor: "center" })
    .setLngLat(markers.carAStart)
    .addTo(map);
  const carBMarker = new mapboxgl.Marker({ element: carB.wrapper, anchor: "center" })
    .setLngLat(markers.carBStart)
    .addTo(map);
  const carCMarker = new mapboxgl.Marker({ element: carC.wrapper, anchor: "center" })
    .setLngLat(markers.laundryCoord)
    .addTo(map);

  carC.element.style.opacity = "0";
  lastMissionCarMarker = carCMarker;

  const inboundDuration =
    plan === "Flash" ? 16000 : plan === "Premium" ? 22000 : 20000;
  const processingDuration =
    plan === "Premium" ? 10000 : 7000;
  const outboundDuration =
    plan === "Flash" ? 12000 : 16000;

  await Promise.all([
    animateMarkerAlongRoute(map, carAMarker, pathACoords, {
      durationMs: inboundDuration,
      phase: "Inbound",
      carId: "CarA",
      onTelemetry,
      mountAtCoordinate: markers.helperCoord,
      mountElement: markers.helperElement,
      headingElement: carA.element,
      onReachMount: markers.onHelperPickup,
    }),
    animateMarkerAlongRoute(map, carBMarker, pathBCoords, {
      durationMs: inboundDuration,
      phase: "Inbound",
      carId: "CarB",
      onTelemetry,
      mountAtCoordinate: markers.clientCoord,
      mountElement: markers.clientElement,
      headingElement: carB.element,
      hideMountOnReach: false,
      onReachMount:
        plan === "Premium" || plan === "Eco" || plan === "Flash"
          ? () => {
              map.easeTo({
                center: markers.laundryCoord,
                zoom: 15,
                duration: inboundDuration / 2,
              });
            }
          : undefined,
    }),
  ]);

  carA.element.style.opacity = "0";
  carB.element.style.opacity = "0";

  if (!laundryFailure) {
    startLaundryProcessingAnimation(markers.laundryElement, processingDuration);

    const countdownElement = createCountdownMarkerElement(processingDuration);
    const countdownMarker = new mapboxgl.Marker({ element: countdownElement, anchor: "center" })
      .setLngLat(markers.laundryCoord)
      .addTo(map);

    if (onTelemetry) {
      onTelemetry({
        carId: "Hub",
        lat: markers.laundryCoord[1],
        lng: markers.laundryCoord[0],
        speedKmh: 0,
        phase: "Processing",
      });
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, processingDuration);
    });

    countdownMarker.remove();
  }

  carC.element.style.opacity = "1";

  await animateMarkerAlongRoute(map, carCMarker, pathCCoords, {
    durationMs: outboundDuration,
    phase: "Outbound",
    carId: "CarC",
    onTelemetry,
    headingElement: carC.element,
    onCameraUpdate: followHandler ?? undefined,
  });

  if (plan === "Eco" && markers.helperHomeCoord) {
    carCMarker.setLngLat(markers.helperHomeCoord);
  } else {
    carCMarker.setLngLat(markers.clientCoord);
  }

  startHouseArrivalAnimation(markers.clientElement, 600);

  if (onTelemetry) {
    onTelemetry({
      carId: "CarC",
      lat: markers.clientCoord[1],
      lng: markers.clientCoord[0],
      speedKmh: 0,
      phase: "Completed",
    });
  }

  carC.element.innerHTML = createTopDownVehicleSvg("#3B82F6");

  carAMarker.remove();
  carBMarker.remove();

  if (showRoutes !== false) {
    createOrUpdateRouteSource(map, "routeA", []);
    createOrUpdateRouteSource(map, "routeB", []);
    createOrUpdateRouteSource(map, "routeC", []);
  }

  const roamingTargets: [number, number][] = [
    markers.laundryCoord,
    markers.clientCoord,
    markers.helperHomeCoord ?? markers.helperCoord,
  ];

  void (async () => {
    let current: [number, number] = carCMarker
      .getLngLat()
      .toArray() as [number, number];

    while (lastMissionCarMarker === carCMarker) {
      const target =
        roamingTargets[Math.floor(Math.random() * roamingTargets.length)] ??
        current;

      const route = await fetchRoute(mapboxToken, [current, target]);

      if (lastMissionCarMarker !== carCMarker) {
        return;
      }

      if (!route.length) {
        continue;
      }

      const durationMs = 22000 + Math.random() * 12000;

      await animateMarkerAlongRoute(map, carCMarker, route, {
        durationMs,
        phase: "Inbound",
        carId: "CarC",
        headingElement: carC.element,
      });

      if (lastMissionCarMarker !== carCMarker) {
        return;
      }

      const last = route[route.length - 1];
      current = [last[0], last[1]];
    }
  })();
}

export function startLaundryProcessingAnimation(
  element: HTMLDivElement | null,
  durationMs: number
) {
  if (!element) {
    return;
  }

  element.style.transition = "transform 0.8s ease-in-out, box-shadow 0.8s ease-in-out";
  element.style.boxShadow = "0 0 26px rgba(255,127,80,0.9)";
  element.style.transformOrigin = "center center";

  let growing = true;
  const intervalId = window.setInterval(() => {
    element.style.transform = growing ? "scale(1.06)" : "scale(0.98)";
    growing = !growing;
  }, 800);

  window.setTimeout(() => {
    window.clearInterval(intervalId);
    element.style.transform = "scale(1)";
    element.style.boxShadow = "";
  }, durationMs);
}

export function startHouseArrivalAnimation(element: HTMLDivElement | null, durationMs: number) {
  if (!element) {
    return;
  }

  const originalTransform = element.style.transform;
  const originalBoxShadow = element.style.boxShadow;
  element.style.transition =
    "transform 0.4s ease-out, box-shadow 0.4s ease-out";
  element.style.transformOrigin = "center center";
  element.style.transform = "scale(1.2)";
  element.style.boxShadow = "0 0 26px rgba(250,204,21,0.95)";

  window.setTimeout(() => {
    try {
      element.style.transform = originalTransform || "scale(1)";
      element.style.boxShadow = originalBoxShadow;
    } catch {
    }
  }, durationMs);
}

export function createCountdownMarkerElement(durationMs: number) {
  const element = document.createElement("div");
  element.style.width = "22px";
  element.style.height = "22px";
  element.style.borderRadius = "999px";
  element.style.border = "1.5px solid rgba(148,163,184,0.7)";
  element.style.boxShadow = "0 0 12px rgba(148,163,184,0.65)";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.background =
    "conic-gradient(rgba(45,212,191,0.9) 0deg, rgba(15,23,42,1) 0deg)";

  const inner = document.createElement("div");
  inner.style.width = "14px";
  inner.style.height = "14px";
  inner.style.borderRadius = "999px";
  inner.style.background =
    "radial-gradient(circle at 30% 20%, rgba(248,250,252,0.08), transparent 55%), rgba(15,23,42,0.96)";
  inner.style.color = "rgba(226,232,240,0.9)";
  inner.style.fontSize = "8px";
  inner.style.display = "flex";
  inner.style.alignItems = "center";
  inner.style.justifyContent = "center";
  inner.style.fontFamily = "system-ui, sans-serif";
  inner.textContent = "";
  element.appendChild(inner);

  const start = performance.now();
  const frame = (now: number) => {
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const angle = 360 * (1 - t);
    element.style.background =
      `conic-gradient(rgba(56,189,248,0.9) ${angle}deg, rgba(15,23,42,1) ${angle}deg)`;
    if (t < 1) {
      requestAnimationFrame(frame);
    }
  };
  requestAnimationFrame(frame);

  return element;
}

export function ensureRouteLayer(map: mapboxgl.Map, id: string, zIndexOrder: string[]) {
  const layerId = `${id}-line`;
  if (map.getLayer(layerId)) {
    return;
  }

  let beforeId: string | undefined;

  zIndexOrder.forEach((candidateId) => {
    const layerCandidate = `${candidateId}-line`;
    if (map.getLayer(layerCandidate)) {
      beforeId = layerCandidate;
    }
  });

  const isReturnRoute = id === "routeC";

  const layerConfig: mapboxgl.LineLayer = {
    id: layerId,
    type: "line",
    source: id,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-width": 4,
      "line-color": isReturnRoute ? "#F97316" : "#38BDF8",
      "line-opacity": 0.9,
      "line-blur": 0.2,
      "line-gradient": [
        "interpolate",
        ["linear"],
        ["line-progress"],
        0.0,
        isReturnRoute ? "rgba(249,115,22,0.12)" : "rgba(56,189,248,0.12)",
        0.2,
        isReturnRoute ? "rgba(249,115,22,0.65)" : "rgba(56,189,248,0.65)",
        0.5,
        isReturnRoute ? "rgba(249,115,22,0.98)" : "rgba(56,189,248,0.98)",
        1.0,
        "rgba(255,255,255,0.98)",
      ],
    },
  };

  if (beforeId) {
    map.addLayer(layerConfig, beforeId);
  } else {
    map.addLayer(layerConfig);
  }
}

export function createOrUpdateReturnBufferZone(
  map: mapboxgl.Map,
  origin: [number, number],
  home: [number, number]
) {
  const sourceId = "return-buffer";
  const layerId = "return-buffer-line";
  const coordinates: [number, number][] = [origin, home];
  const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  const data = {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
    properties: {},
  };
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data,
    });
  }
  if (!map.getLayer(layerId)) {
    const layerConfig: mapboxgl.LineLayer = {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-width": 10,
        "line-color": "#A855F7",
        "line-opacity": 0.35,
        "line-blur": 1.2,
      },
    };
    map.addLayer(layerConfig);
  }
}

export function clearReturnBufferZone(map: mapboxgl.Map) {
  const layerId = "return-buffer-line";
  const sourceId = "return-buffer";
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

export function createCarMarkerElement() {
  const wrapper = document.createElement("div");
  const element = document.createElement("div");
  element.className = "vehicle-marker-svg";
  element.innerHTML = createTopDownVehicleSvg("#3B82F6");
  wrapper.appendChild(element);
  return { wrapper, element };
}

export function createOrUpdateQueuedSpiderLines(map: mapboxgl.Map, orders: Order[]) {
  const sourceId = "queued-spider";
  const layerId = "queued-spider-line";
  const features = orders
    .filter((order) => order.status === "Queued")
    .map((order) => {
      const house = houseClients.find((item) => item.id === order.houseId);
      const laundry = laundryLocations.find((item) => item.id === order.laundryId);
      if (!house || !laundry) {
        return null;
      }
      return {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [house.coordinates, laundry.coordinates],
        },
        properties: {
          orderId: order.id,
        },
      };
    })
    .filter((item) => item !== null) as {
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { orderId: string };
  }[];
  const data = {
    type: "FeatureCollection" as const,
    features,
  };
  const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data,
    });
  }
  if (!map.getLayer(layerId)) {
    const layerConfig: mapboxgl.LineLayer = {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-width": 2,
        "line-color": "#38BDF8",
        "line-opacity": 0.45,
        "line-dasharray": [1, 1.6],
      },
    };
    map.addLayer(layerConfig);
  }
}

export function createOrUpdateRescueSpiderLines(map: mapboxgl.Map, state: RoutingEngineState) {
  const sourceId = "rescue-spider";
  const layerId = "rescue-spider-line";
  const activeOrderIds = Object.entries(state.assetStatus)
    .filter((entry) => {
      const status = entry[1];
      return (
        status === "InRescue" ||
        status === "PendingRescue" ||
        status === "SearchingForNewHelper"
      );
    })
    .map((entry) => entry[0]);
  const features = state.assignments
    .filter((assignment) => activeOrderIds.includes(assignment.orderId))
    .map((assignment) => {
      const helper = helpers.find((item) => item.id === assignment.helperId);
      const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
      if (!helper || !vehicle) {
        return null;
      }
      return {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: [helper.coordinates, vehicle.coordinates],
        },
        properties: {
          orderId: assignment.orderId,
          helperId: assignment.helperId,
          vehicleId: assignment.vehicleId,
        },
      };
    })
    .filter((item) => item !== null) as {
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { orderId: string; helperId: string; vehicleId: string };
  }[];
  const data = {
    type: "FeatureCollection" as const,
    features,
  };
  const existingSource = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data,
    });
  }
  if (!map.getLayer(layerId)) {
    const layerConfig: mapboxgl.LineLayer = {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-width": 2.5,
        "line-color": "#EF4444",
        "line-opacity": 0.6,
        "line-dasharray": [0.6, 1.1],
      },
    };
    map.addLayer(layerConfig);
  }
}

export function createCameraFollowHandler(
  map: mapboxgl.Map,
  bounds: mapboxgl.LngLatBounds,
  mode: FollowMode,
  options?: {
    bufferedAlpha?: number;
    regionAlpha?: number;
    innerPaddingRatio?: number;
  }
) {
  let lastCenter: mapboxgl.LngLat | null = null;
  const bufferedAlpha = options?.bufferedAlpha ?? 0.18;
  const regionAlpha = options?.regionAlpha ?? 0.22;
  const innerPaddingRatio = options?.innerPaddingRatio ?? 0.2;
  return (lng: number, lat: number) => {
    const target = new mapboxgl.LngLat(lng, lat);
    if (mode === "strict") {
      map.setCenter(target);
      lastCenter = target;
      return;
    }
    if (!lastCenter) {
      lastCenter = target;
      map.setCenter(target);
      return;
    }
    if (mode === "buffered") {
      const nextLng = lastCenter.lng + (target.lng - lastCenter.lng) * bufferedAlpha;
      const nextLat = lastCenter.lat + (target.lat - lastCenter.lat) * bufferedAlpha;
      const next = new mapboxgl.LngLat(nextLng, nextLat);
      map.setCenter(next);
      lastCenter = next;
      return;
    }
    if (mode === "region") {
      const west = bounds.getWest();
      const east = bounds.getEast();
      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const width = east - west;
      const height = north - south;
      const innerBounds = new mapboxgl.LngLatBounds(
        [west + width * innerPaddingRatio, south + height * innerPaddingRatio],
        [east - width * innerPaddingRatio, north - height * innerPaddingRatio]
      );
      if (innerBounds.contains(target)) {
        return;
      }
      const base = lastCenter ?? map.getCenter();
      const nextLng = base.lng + (target.lng - base.lng) * regionAlpha;
      const nextLat = base.lat + (target.lat - base.lat) * regionAlpha;
      const next = new mapboxgl.LngLat(nextLng, nextLat);
      map.setCenter(next);
      lastCenter = next;
    }
  };
}

export function animateMarkerAlongRoute(
  map: mapboxgl.Map,
  marker: mapboxgl.Marker,
  coordinates: [number, number][],
  options: {
    durationMs: number;
    phase?: TelemetrySnapshot["phase"];
    carId?: string;
    onTelemetry?: (snapshot: TelemetrySnapshot) => void;
    mountAtCoordinate?: [number, number];
    mountElement?: HTMLDivElement | null;
    headingElement?: HTMLElement | null;
    onReachMount?: () => void;
    onCameraUpdate?: (lng: number, lat: number) => void;
    hideMountOnReach?: boolean;
  }
): Promise<void> {
  const {
    durationMs,
    phase,
    carId,
    onTelemetry,
    mountAtCoordinate,
    mountElement,
    headingElement,
    onReachMount,
    onCameraUpdate,
    hideMountOnReach = true,
  } = options;
  
  // Note: speedKmh calculation depends on length which requires routeLengthKm.
  // Using a simplified speed calc if length is 0.
  const lengthKm = routeLengthKm(coordinates);
  const speedKmh = lengthKm === 0 ? 0 : lengthKm / (durationMs / 3600000);

  let start: number | null = null;
  let mounted = false;
  let lastAngleDeg: number | null = null;

  return new Promise<void>((resolve) => {
    const step = (timestamp: number) => {
      if (start === null) {
        start = timestamp;
      }

      const elapsed = timestamp - start;
      const tLinear = durationMs === 0 ? 1 : Math.min(1, elapsed / durationMs);
      const t = tLinear === 1 ? 1 : 0.5 - Math.cos(Math.PI * tLinear) / 2;
      const indexFloat = t * (coordinates.length - 1);
      const index = Math.floor(indexFloat);
      const nextIndex = Math.min(coordinates.length - 1, index + 1);
      const segmentT = indexFloat - index;

      const from = coordinates[index];
      const to = coordinates[nextIndex];
      const lng = from[0] + (to[0] - from[0]) * segmentT;
      const lat = from[1] + (to[1] - from[1]) * segmentT;

      marker.setLngLat([lng, lat]);

      if (onCameraUpdate) {
        onCameraUpdate(lng, lat);
      }

      if (headingElement) {
        const dx = to[0] - from[0];
        const dy = to[1] - from[1];
        const angleRad = Math.atan2(dy, dx);
        const roadAngleDeg = (angleRad * 180) / Math.PI;
        const baseAngleDeg = roadAngleDeg - 90;
        let renderAngleDeg = baseAngleDeg;
        if (lastAngleDeg !== null) {
          let diff = baseAngleDeg - lastAngleDeg;
          diff = ((diff + 180) % 360) - 180;
          if (Math.abs(diff) < 1) {
            renderAngleDeg = baseAngleDeg;
          } else {
            renderAngleDeg = lastAngleDeg + diff * 0.15;
          }
        }
        lastAngleDeg = renderAngleDeg;
        headingElement.style.transform = `rotate(${renderAngleDeg}deg)`;
      }

      if (onTelemetry) {
        onTelemetry({
          carId: carId ?? "unknown",
          lat,
          lng,
          speedKmh,
          phase: phase ?? "Inbound",
          heading: lastAngleDeg ?? 0,
          battery: 100,
          status: phase ?? "Active",
        });
      }

      if (mountAtCoordinate && mountElement && !mounted) {
        const distanceToMount = haversineDistanceKm(mountAtCoordinate, [lng, lat]) * 1000;
        if (distanceToMount < 20) {
          if (hideMountOnReach) {
            mountElement.style.opacity = "0";
          }
          mounted = true;
          if (onReachMount) {
            onReachMount();
          }
        }
      }

      if (tLinear < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(step);
  });
}
