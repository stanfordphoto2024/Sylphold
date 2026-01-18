import { useEffect, useState, useRef, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import { MapLegend } from "./components/MapLegend";

type LaundryLocation = {
  id: string;
  name: string;
  coordinates: [number, number];
  type: "Dusty Mauve";
  tags: string[];
  status: string;
};

type HouseClient = {
  id: string;
  coordinates: [number, number];
};

type Helper = {
  id: string;
  coordinates: [number, number];
};

type Vehicle = {
  id: string;
  coordinates: [number, number];
};

type OrderStatus = "Queued" | "PickingUp" | "Processing" | "Delivering" | "Completed";

type OrderMedia = {
  bundleShots: string[];
  machineShots: string[];
};

type Order = {
  id: string;
  createdAt: number;
  status: OrderStatus;
  houseId: string;
  laundryId: string;
  helperId?: string;
  machineFailed?: boolean;
  secondCycleUnlocked?: boolean;
  homeModeAtCreation?: boolean;
  rating?: number;
  ratingReason?: string;
  media?: OrderMedia;
};

const laundryLocations: LaundryLocation[] = [
  {
    id: "laundry_01",
    name: "Suds Yer Duds",
    coordinates: [-122.0782, 37.3931],
    type: "Dusty Mauve",
    tags: ["Coin-op", "High Capacity"],
    status: "Partnered",
  },
  {
    id: "laundry_02",
    name: "Mountain View Laundry",
    coordinates: [-122.0635, 37.3794],
    type: "Dusty Mauve",
    tags: ["Card-system", "24/7"],
    status: "Active",
  },
  {
    id: "laundry_03",
    name: "The Laundry Basket",
    coordinates: [-122.1141, 37.4012],
    type: "Dusty Mauve",
    tags: ["App-pay", "Eco-friendly"],
    status: "Maintenance",
  },
  {
    id: "laundry_04",
    name: "E-Z Wash Laundry",
    coordinates: [-122.0912, 37.4055],
    type: "Dusty Mauve",
    tags: ["Coin-op", "Wuff-and-Fold"],
    status: "Partnered",
  },
  {
    id: "laundry_05",
    name: "Laundromat @ El Camino",
    coordinates: [-122.1023, 37.3888],
    type: "Dusty Mauve",
    tags: ["Touch-pay", "Lounge Area"],
    status: "Active",
  },
  {
    id: "laundry_06",
    name: "Showers & Laundry Center",
    coordinates: [-122.0831, 37.412],
    type: "Dusty Mauve",
    tags: ["Premium Service", "Sylphold Express"],
    status: "Active",
  },
];

const houseClients: HouseClient[] = [
  {
    id: "house_01",
    coordinates: [-122.0815, 37.3862],
  },
  {
    id: "house_02",
    coordinates: [-122.075, 37.3828],
  },
  {
    id: "house_03",
    coordinates: [-122.0897, 37.3925],
  },
  {
    id: "house_04",
    coordinates: [-122.0972, 37.3839],
  },
  {
    id: "house_05",
    coordinates: [-122.0863, 37.3787],
  },
];

const helpers: Helper[] = [
  { id: "helper_01", coordinates: [-122.0729, 37.3895] },
  { id: "helper_02", coordinates: [-122.0938, 37.3973] },
  { id: "helper_03", coordinates: [-122.0824, 37.3739] },
  { id: "helper_04", coordinates: [-122.0785, 37.3821] },
  { id: "helper_05", coordinates: [-122.0872, 37.3847] },
  { id: "helper_06", coordinates: [-122.0701, 37.3952] },
  { id: "helper_07", coordinates: [-122.0984, 37.3929] },
  { id: "helper_08", coordinates: [-122.0903, 37.3788] },
  { id: "helper_09", coordinates: [-122.0817, 37.3995] },
  { id: "helper_10", coordinates: [-122.0754, 37.387] },
  { id: "helper_11", coordinates: [-122.0859, 37.3908] },
  { id: "helper_12", coordinates: [-122.0921, 37.4023] },
];

const helperHomeTargets: Record<string, [number, number]> = {};

helpers.forEach((helper) => {
  if (!houseClients.length) {
    return;
  }
  let bestHouse = houseClients[0];
  let bestDistance = Math.hypot(
    bestHouse.coordinates[0] - helper.coordinates[0],
    bestHouse.coordinates[1] - helper.coordinates[1]
  );
  for (let index = 1; index < houseClients.length; index += 1) {
    const candidate = houseClients[index];
    const distance = Math.hypot(
      candidate.coordinates[0] - helper.coordinates[0],
      candidate.coordinates[1] - helper.coordinates[1]
    );
    if (distance < bestDistance) {
      bestHouse = candidate;
      bestDistance = distance;
    }
  }
  helperHomeTargets[helper.id] = bestHouse.coordinates;
});

const vehicles: Vehicle[] = [
  {
    id: "vehicle_01",
    coordinates: [-122.079, 37.3925],
  },
  {
    id: "vehicle_02",
    coordinates: [-122.0675, 37.3802],
  },
  {
    id: "vehicle_03",
    coordinates: [-122.1105, 37.3998],
  },
  {
    id: "vehicle_04",
    coordinates: [-122.089, 37.407],
  },
  {
    id: "vehicle_05",
    coordinates: [-122.095, 37.389],
  },
  {
    id: "vehicle_06",
    coordinates: [-122.074, 37.395],
  },
  {
    id: "vehicle_07",
    coordinates: [-122.0825, 37.4002],
  },
  {
    id: "vehicle_08",
    coordinates: [-122.088, 37.3835],
  },
];

type MarkerWithElement = {
  marker: mapboxgl.Marker;
  element: HTMLDivElement;
  id: string;
};

type TelemetrySnapshot = {
  carId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  phase: "Inbound" | "Processing" | "Outbound" | "Completed";
};

type FollowMode = "strict" | "buffered" | "region";

type PlanId = "Flash" | "Eco" | "Premium";

type PlanMetrics = {
  id: PlanId;
  label: string;
  totalDistanceKm: number;
  estimatedMinutes: number;
  laundryLoad: number;
  helperLoad: number;
  efficiency: number;
  chainOfCustodyScore: number;
  faultRecoveryScore: number;
  compositeScore: number;
  guaranteeAdjustment: number;
};

type LockStatus = "idle" | "locked" | "preparing" | "ready" | "unlocked" | "error";

type LockUnlockLog = {
  id: string;
  timestamp: number;
  method: "code" | "biometric";
  success: boolean;
  note?: string;
};

type WeightConfig = {
  distance: number;
  load: number;
  efficiency: number;
};

type PlanHistoryEntry = {
  id: string;
  plan: PlanId;
  timestamp: number;
  compositeScore: number;
  totalDistanceKm: number;
  estimatedMinutes: number;
};

type FlashHelperStats = {
  helper: Helper;
  foldingScore: number;
  rescueScore: number;
  combinedScore: number;
  avgEngagedMinutes: number;
  avgTargetMinutes: number;
  avgRescueEtaSeconds: number;
};

type PremiumHelperStats = {
  helper: Helper;
  neatnessScore: number;
  integrityScore: number;
  qualityScore: number;
  strikes: number;
};

type HelperStatus = "available" | "unavailable";

type HelperSimEntry = {
  id: string;
  status: HelperStatus;
  active: boolean;
};

type HelperSimConfig = {
  initialActive: number;
  minActive: number;
  maxActive: number;
  adjustIntervalMinMs: number;
  adjustIntervalMaxMs: number;
  statusToggleMinMs: number;
  statusToggleMaxMs: number;
};

type HelperSimLogEntry = {
  id: string;
  helperId: string;
  timestamp: number;
  type: "added" | "removed" | "statusChanged";
  from?: HelperStatus;
  to?: HelperStatus;
};

type HelperSimApi = {
  helpers: HelperSimEntry[];
  activeHelpers: HelperSimEntry[];
  running: boolean;
  toggleRunning: () => void;
  logs: HelperSimLogEntry[];
};

type HelperIntegrity = {
  score: number;
  strikes: number;
  highValueEligible: boolean;
};

type AssetTransferStatus =
  | "Pending"
  | "InRescue"
  | "Transferred"
  | "PendingRescue"
  | "SearchingForNewHelper";

type DispatchAssignmentStatus = "EnRoute" | "AtScene" | "Completed";

type DispatchAssignment = {
  id: string;
  orderId: string;
  helperId: string;
  vehicleId: string;
  attempt: number;
  status: DispatchAssignmentStatus;
};

type RoutingEngineState = {
  assignments: DispatchAssignment[];
  assetStatus: Record<string, AssetTransferStatus>;
  rescueEtaSeconds: Record<string, number>;
  searchRadiusKm: Record<string, number>;
  rescueBonusMultiplier: Record<string, number>;
  trunkUnlocked: Record<string, boolean>;
};

type CollisionEvent = {
  id: string;
  orderId: string;
  vehicleId: string;
  timestamp: number;
  location: [number, number];
};

type Prop22EvaluationStatus = "Normal" | "Exception Pending";

type Prop22Evaluation = {
  orderId: string;
  engagedMinutes: number;
  washStandardMinutes: number;
  dryStandardMinutes: number;
  status: Prop22EvaluationStatus;
};

let helpersHiddenByOrderSim = false;
let lastMissionCarMarker: mapboxgl.Marker | null = null;

const helperSopChecklist: Record<string, string[]> = {
  helper_01: [
    "Confirm detergent dosage",
    "Check drying time and temperature",
    "Fold layers in sequence",
    "Second odor check",
  ],
  helper_02: [
    "Confirm sorted washing",
    "Set spin time before drying",
    "Align edges while folding",
    "Smell before sealing bag",
  ],
  helper_03: [
    "Check pockets are empty pre-wash",
    "Low-heat dry shrink-prone fabrics",
    "Fold items in same direction",
    "Keep tags facing inward",
  ],
  default: ["Confirm detergent dosage", "Fold layers in sequence", "Second odor check"],
};

const bundlePlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#020617"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g1)"/>
  <rect x="32" y="40" width="256" height="144" rx="18" fill="#020617" stroke="#38bdf8" stroke-width="4"/>
  <rect x="56" y="64" width="72" height="96" rx="10" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/>
  <rect x="120" y="64" width="72" height="96" rx="10" fill="#0f172a" stroke="#4ade80" stroke-width="3"/>
  <rect x="184" y="64" width="72" height="96" rx="10" fill="#020617" stroke="#a855f7" stroke-width="3"/>
  <line x1="48" y1="152" x2="272" y2="152" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const machinePlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
  <defs>
    <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="1" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g2)"/>
  <rect x="56" y="32" width="208" height="176" rx="24" fill="#020617" stroke="#38bdf8" stroke-width="4"/>
  <circle cx="160" cy="112" r="56" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
  <path d="M120 112c12-18 32-28 40-28 12 0 28 10 40 28" fill="none" stroke="#22c55e" stroke-width="4" stroke-linecap="round"/>
  <circle cx="120" cy="68" r="6" fill="#38bdf8"/>
  <circle cx="160" cy="68" r="6" fill="#4ade80"/>
  <circle cx="200" cy="68" r="6" fill="#a855f7"/>
</svg>`;

const bundlePlaceholderUrl = `data:image/svg+xml,${encodeURIComponent(bundlePlaceholderSvg)}`;
const machinePlaceholderUrl = `data:image/svg+xml,${encodeURIComponent(machinePlaceholderSvg)}`;

function createMockOrderMedia(): OrderMedia {
  const bundleShots = [bundlePlaceholderUrl, bundlePlaceholderUrl, bundlePlaceholderUrl, bundlePlaceholderUrl];
  const machineShots = [machinePlaceholderUrl, machinePlaceholderUrl];
  return { bundleShots, machineShots };
}

function handleCollisionWithRecursiveDispatch(
  previousState: RoutingEngineState,
  event: CollisionEvent,
  options: {
    helperId: string;
    helperAtLaundry: boolean;
    availableHelpers: HelperSimEntry[];
  }
): RoutingEngineState {
  const currentAssignments = previousState.assignments.filter(
    (entry) => entry.orderId === event.orderId
  );
  const attempt = currentAssignments.length + 1;

  const assetStatus: AssetTransferStatus =
    previousState.assetStatus[event.orderId] ?? "Pending";

  const nextState: RoutingEngineState = {
    assignments: [...previousState.assignments],
    assetStatus: { ...previousState.assetStatus },
    rescueEtaSeconds: { ...previousState.rescueEtaSeconds },
    searchRadiusKm: { ...previousState.searchRadiusKm },
    rescueBonusMultiplier: { ...previousState.rescueBonusMultiplier },
    trunkUnlocked: { ...previousState.trunkUnlocked },
  };

  const currentRadius = nextState.searchRadiusKm[event.orderId] ?? 1;
  const currentBonus = nextState.rescueBonusMultiplier[event.orderId] ?? 1;

  let nextStatus: AssetTransferStatus = assetStatus;

  if (assetStatus === "Transferred") {
    nextStatus = "Transferred";
  } else if (currentAssignments.length === 0) {
    nextStatus = "InRescue";
    nextState.searchRadiusKm[event.orderId] = currentRadius;
    nextState.rescueBonusMultiplier[event.orderId] = currentBonus;
  } else {
    nextStatus = "SearchingForNewHelper";
    nextState.searchRadiusKm[event.orderId] = Math.min(currentRadius * 1.5, 25);
    nextState.rescueBonusMultiplier[event.orderId] = Math.min(currentBonus + 0.5, 5);
  }

  nextState.assetStatus[event.orderId] = nextStatus;

  const usedHelpers = currentAssignments.map((entry) => entry.helperId);

  const activeHelpers = options.availableHelpers.filter((entry) => entry.active);
  let selectedHelperId = options.helperId;

  if (usedHelpers.includes(selectedHelperId)) {
    const nextHelper =
      activeHelpers.find((entry) => !usedHelpers.includes(entry.id)) ??
      activeHelpers[0];
    if (nextHelper) {
      selectedHelperId = nextHelper.id;
    }
  }

  let selectedVehicleId = event.vehicleId;

  if (options.helperAtLaundry) {
    const helper = helpers.find((item) => item.id === selectedHelperId);
    if (helper) {
      const candidates = vehicles.filter((vehicle) => vehicle.id !== event.vehicleId);
      if (candidates.length > 0) {
        let best = candidates[0];
        let bestDistance = haversineDistanceKm(best.coordinates, helper.coordinates);
        for (let index = 1; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          const distance = haversineDistanceKm(candidate.coordinates, helper.coordinates);
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        }
        selectedVehicleId = best.id;
      }
    }
  }

  const assignment: DispatchAssignment = {
    id: `dispatch_${event.orderId}_${selectedHelperId}_${selectedVehicleId}_${attempt}`,
    orderId: event.orderId,
    helperId: selectedHelperId,
    vehicleId: selectedVehicleId,
    attempt,
    status: "EnRoute",
  };

  nextState.assignments.push(assignment);

  const helper = helpers.find((item) => item.id === selectedHelperId);
  if (helper) {
    const distanceKm = haversineDistanceKm(helper.coordinates, event.location);
    const speedKmh = 40;
    const etaSeconds = Math.max(5, Math.round((distanceKm / speedKmh) * 3600));
    nextState.rescueEtaSeconds[event.orderId] = etaSeconds;
    const distanceM = distanceKm * 1000;
    if (distanceM < 10) {
      nextState.trunkUnlocked[event.orderId] = true;
    }
  }

  return nextState;
}

function markAssetTransferCompleted(
  previousState: RoutingEngineState,
  orderId: string
): RoutingEngineState {
  const nextState: RoutingEngineState = {
    assignments: previousState.assignments.map((entry) =>
      entry.orderId === orderId ? { ...entry, status: "Completed" } : entry
    ),
    assetStatus: { ...previousState.assetStatus },
    rescueEtaSeconds: { ...previousState.rescueEtaSeconds },
    searchRadiusKm: { ...previousState.searchRadiusKm },
    rescueBonusMultiplier: { ...previousState.rescueBonusMultiplier },
    trunkUnlocked: { ...previousState.trunkUnlocked },
  };
  nextState.assetStatus[orderId] = "Transferred";
   nextState.trunkUnlocked[orderId] = true;
  return nextState;
}

function evaluateProp22Compliance(params: {
  orderId: string;
  engagedStart: number;
  engagedEnd: number;
  actualWashMinutes: number;
  actualDryMinutes: number;
}): Prop22Evaluation {
  const engagedMs = Math.max(0, params.engagedEnd - params.engagedStart);
  const engagedMinutes = engagedMs / 60000;
  const washStandardMinutes = 30;
  const dryStandardMinutes = 35;

  const breach =
    params.actualWashMinutes > washStandardMinutes ||
    params.actualDryMinutes > dryStandardMinutes;

  return {
    orderId: params.orderId,
    engagedMinutes,
    washStandardMinutes,
    dryStandardMinutes,
    status: breach ? "Exception Pending" : "Normal",
  };
}

function computeEngagedMinutes(order: Order, nowMs: number) {
  const engagedMs = Math.max(0, nowMs - order.createdAt);
  return Math.floor(engagedMs / 60000);
}

function computeOrderEngagementProfile(params: {
  order: Order;
  nowMs: number;
  house?: HouseClient;
  laundry?: LaundryLocation;
  allOrders: Order[];
}) {
  const { order, nowMs, house, laundry, allOrders } = params;
  const distanceKm =
    house && laundry ? haversineDistanceKm(house.coordinates, laundry.coordinates) : 3.5;
  const load = computeLaundryLoad(order.laundryId, allOrders);
  const baseMinutes = 36 + distanceKm * 4;
  const loadPenalty = (load - 0.35) * 40;
  let targetMinutes = Math.round(baseMinutes + loadPenalty);
  targetMinutes = Math.max(36, Math.min(90, targetMinutes));
  const rawLinear =
    targetMinutes <= 0
      ? 0
      : Math.max(0, Math.min(1.3, (nowMs - order.createdAt) / (targetMinutes * 60000)));
  let phaseFloor = 0;
  if (order.status === "PickingUp") {
    phaseFloor = 0.1;
  } else if (order.status === "Processing") {
    phaseFloor = 0.4;
  } else if (order.status === "Delivering") {
    phaseFloor = 0.8;
  } else if (order.status === "Completed") {
    phaseFloor = 1.05;
  }
  let progress = Math.max(phaseFloor, rawLinear);
  const rating = typeof order.rating === "number" ? order.rating : 4;
  const clampedRating = Math.max(1, Math.min(5, rating));
  const ratingNormalized = (clampedRating - 3) / 2;
  const ratingFactor = 1 - ratingNormalized * 0.12;
  progress *= ratingFactor;
  progress = Math.max(0, Math.min(1.3, progress));
  let engagedMinutes = Math.round(progress * targetMinutes);
  if (engagedMinutes <= 0 && rawLinear > 0) {
    engagedMinutes = 1;
  }
  engagedMinutes = Math.max(0, Math.min(targetMinutes + 10, engagedMinutes));
  const efficiencyRatio =
    targetMinutes <= 0 ? 1 : Math.max(0, Math.min(2, engagedMinutes / targetMinutes));
  return { engagedMinutes, targetMinutes, efficiencyRatio };
}

function computeGuaranteeAdjustment(
  engagedMinutes: number,
  targetMinutes: number,
  rating?: number
) {
  const minWagePerHour = 16;
  const guaranteeMultiplier = 1.2;
  const revenue = (targetMinutes / 60) * minWagePerHour;
  const guaranteePayout = (engagedMinutes / 60) * (minWagePerHour * guaranteeMultiplier);
  const baseAdjustment = revenue - guaranteePayout;
  let ratingFactor = 1;
  if (typeof rating === "number") {
    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
    if (clamped >= 5) {
      ratingFactor = 1.1;
    } else if (clamped >= 4) {
      ratingFactor = 1;
    } else if (clamped >= 3) {
      ratingFactor = 0.9;
    } else if (clamped >= 2) {
      ratingFactor = 0.7;
    } else {
      ratingFactor = 0.5;
    }
  }
  const adjusted = baseAdjustment * ratingFactor;
  return Math.round(adjusted * 100) / 100;
}

function formatStarRating(rating: number) {
  const clamped = Math.max(1, Math.min(5, Math.round(rating)));
  let stars = "";
  for (let index = 0; index < 5; index += 1) {
    stars += index < clamped ? "★" : "☆";
  }
  return stars;
}

function syncHelperMarkersWithSimulation(
  context: { helperMarkers: MarkerWithElement[] },
  helperStates: HelperSimEntry[]
) {
  if (helpersHiddenByOrderSim) {
    context.helperMarkers.forEach(({ element }) => {
      element.style.opacity = "0";
      element.style.filter = "grayscale(1)";
    });
    return;
  }
  context.helperMarkers.forEach(({ element, id }) => {
    const entry = helperStates.find((item) => item.id === id);
    if (!entry) {
      element.style.opacity = "0";
      element.style.filter = "grayscale(1)";
      return;
    }
    if (!entry.active) {
      element.style.opacity = "0";
      element.style.filter = "grayscale(1)";
      return;
    }
    if (entry.status === "available") {
      element.style.opacity = "1";
      element.style.filter = "none";
      return;
    }
    element.style.opacity = "0.7";
    element.style.filter = "grayscale(0.2)";
  });
}

function syncVehicleMarkersWithAssetStatus(
  context: { vehicleMarkers: MarkerWithElement[] },
  state: RoutingEngineState
) {
  const { assignments, assetStatus, trunkUnlocked } = state;
  if (!assignments.length) {
    context.vehicleMarkers.forEach(({ element }) => {
      element.className = "vehicle-marker-svg";
      element.innerHTML = createTopDownVehicleSvg("#3B82F6");
    });
    return;
  }
  const latest = assignments[assignments.length - 1];
  const orderId = latest.orderId;
  const status = assetStatus[orderId];
  const isTransferring =
    (status === "InRescue" || status === "SearchingForNewHelper") &&
    Boolean(trunkUnlocked[orderId]);
  const incidentVehicleId =
    status === "InRescue" || status === "SearchingForNewHelper"
      ? latest.vehicleId
      : null;
  context.vehicleMarkers.forEach(({ id, element }) => {
    const isIncident = incidentVehicleId && id === incidentVehicleId;
    const isTransferringForMarker = Boolean(isIncident && isTransferring);
    element.className =
      isTransferringForMarker || isIncident
        ? "vehicle-marker-svg incident"
        : "vehicle-marker-svg";
    element.innerHTML = isTransferringForMarker
      ? createTransferringAssetsSvg()
      : createTopDownVehicleSvg(isIncident ? "#EF4444" : "#3B82F6");
  });
}

function createTopDownVehicleSvg(color: string) {
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="6" width="12" height="20" rx="3" fill="${color}" /><rect x="11" y="10" width="10" height="8" rx="2" fill="#E5E7EB" /><circle cx="11" cy="9" r="2" fill="#F9FAFB" /><circle cx="21" cy="9" r="2" fill="#F9FAFB" /><circle cx="11" cy="23" r="2" fill="#F9FAFB" /><circle cx="21" cy="23" r="2" fill="#F9FAFB" /></svg>`;
}

function createTransferringAssetsSvg() {
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="20" height="12" rx="3" fill="#020617" /><rect x="8" y="12" width="7" height="8" rx="1.5" fill="#38BDF8" /><rect x="17" y="12" width="7" height="8" rx="1.5" fill="#F97316" /><path d="M13 16h6" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round"/><path d="M12 14l-2 2 2 2" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 14l2 2-2 2" stroke="#E5E7EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function createRandomInRange(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= 0 || max < min) {
    return 1000;
  }
  const value = min + Math.random() * (max - min);
  if (!Number.isFinite(value) || value <= 0) {
    return 1000;
  }
  return value;
}

export function useHelperSimulation(
  partialConfig?: Partial<HelperSimConfig>
): HelperSimApi {
  const resolvedConfig: HelperSimConfig = {
    initialActive: helpers.length,
    minActive: 3,
    maxActive: helpers.length,
    adjustIntervalMinMs: 5000,
    adjustIntervalMaxMs: 10000,
    statusToggleMinMs: 10000,
    statusToggleMaxMs: 30000,
    ...partialConfig,
  };

  const [helperStates, setHelperStates] = useState<HelperSimEntry[]>(() => {
    const initial: HelperSimEntry[] = helpers.map((helper, index) => ({
      id: helper.id,
      status: "available",
      active: index < resolvedConfig.initialActive,
    }));
    return initial;
  });

  const [running, setRunning] = useState(true);
  const [logs, setLogs] = useState<HelperSimLogEntry[]>([]);

  useEffect(() => {
    if (!running) {
      return;
    }

    let cancelled = false;

    const scheduleNextAdjustment = () => {
      if (cancelled) {
        return;
      }
      const delay = createRandomInRange(
        resolvedConfig.adjustIntervalMinMs,
        resolvedConfig.adjustIntervalMaxMs
      );
      window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setHelperStates((previous) => {
          const active = previous.filter((entry) => entry.active);
          const inactive = previous.filter((entry) => !entry.active);

          const canAdd =
            active.length < resolvedConfig.maxActive && inactive.length > 0;
          const canRemove = active.length > resolvedConfig.minActive;

          if (!canAdd && !canRemove) {
            return previous;
          }

          const shouldAdd =
            canAdd && (!canRemove || Math.random() < 0.5);

          const next = previous.map((entry) => ({ ...entry }));

          if (shouldAdd && canAdd) {
            const target =
              inactive[Math.floor(Math.random() * inactive.length)];
            const index = next.findIndex(
              (entry) => entry.id === target.id
            );
            if (index !== -1) {
              next[index].active = true;
              const logEntry: HelperSimLogEntry = {
                id: `helper_log_${Date.now()}_${target.id}_added`,
                helperId: target.id,
                timestamp: Date.now(),
                type: "added",
              };
              setLogs((previousLogs) =>
                [logEntry, ...previousLogs].slice(0, 80)
              );
            }
          } else if (canRemove) {
            const target =
              active[Math.floor(Math.random() * active.length)];
            const index = next.findIndex(
              (entry) => entry.id === target.id
            );
            if (index !== -1) {
              next[index].active = false;
              const logEntry: HelperSimLogEntry = {
                id: `helper_log_${Date.now()}_${target.id}_removed`,
                helperId: target.id,
                timestamp: Date.now(),
                type: "removed",
              };
              setLogs((previousLogs) =>
                [logEntry, ...previousLogs].slice(0, 80)
              );
            }
          }

          return next;
        });

        scheduleNextAdjustment();
      }, delay);
    };

    scheduleNextAdjustment();

    return () => {
      cancelled = true;
    };
  }, [running, resolvedConfig.adjustIntervalMinMs, resolvedConfig.adjustIntervalMaxMs, resolvedConfig.maxActive, resolvedConfig.minActive]);

  useEffect(() => {
    if (!running) {
      return;
    }

    let cancelled = false;

    const scheduleStatusLoop = (helperId: string) => {
      if (cancelled) {
        return;
      }
      const delay = createRandomInRange(
        resolvedConfig.statusToggleMinMs,
        resolvedConfig.statusToggleMaxMs
      );
      window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        setHelperStates((previous) => {
          const next = previous.map((entry) => ({ ...entry }));
          const index = next.findIndex((entry) => entry.id === helperId);
          if (index === -1) {
            return previous;
          }
          if (!next[index].active) {
            return previous;
          }
          const from = next[index].status;
          const to: HelperStatus =
            from === "available" ? "unavailable" : "available";
          next[index].status = to;

          const logEntry: HelperSimLogEntry = {
            id: `helper_log_${Date.now()}_${helperId}_status`,
            helperId,
            timestamp: Date.now(),
            type: "statusChanged",
            from,
            to,
          };

          setLogs((previousLogs) =>
            [logEntry, ...previousLogs].slice(0, 80)
          );

          return next;
        });

        scheduleStatusLoop(helperId);
      }, delay);
    };

    helpers.forEach((helper) => {
      scheduleStatusLoop(helper.id);
    });

    return () => {
      cancelled = true;
    };
  }, [running, resolvedConfig.statusToggleMinMs, resolvedConfig.statusToggleMaxMs]);

  const activeHelpers = helperStates.filter((entry) => entry.active);

  return {
    helpers: helperStates,
    activeHelpers,
    running,
    toggleRunning: () => setRunning((value) => !value),
    logs,
  };
}

function haversineDistanceKm(a: [number, number], b: [number, number]) {
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

function isOnRouteHome(
  origin: [number, number],
  home: [number, number],
  candidate: [number, number]
) {
  const dirHomeX = home[0] - origin[0];
  const dirHomeY = home[1] - origin[1];
  const dirCandidateX = candidate[0] - origin[0];
  const dirCandidateY = candidate[1] - origin[1];
  const magHome = Math.hypot(dirHomeX, dirHomeY);
  const magCandidate = Math.hypot(dirCandidateX, dirCandidateY);
  if (magHome === 0 || magCandidate === 0) {
    return false;
  }
  const dot = dirHomeX * dirCandidateX + dirHomeY * dirCandidateY;
  const cosTheta = dot / (magHome * magCandidate);
  return cosTheta > 0.75;
}

function routeLengthKm(coords: [number, number][]) {
  let total = 0;
  for (let index = 1; index < coords.length; index += 1) {
    total += haversineDistanceKm(coords[index - 1], coords[index]);
  }
  return total;
}

function computeLaundryLoad(laundryId: string, currentOrders: Order[]) {
  const active = currentOrders.filter((order) => order.status !== "Completed");
  if (active.length === 0) {
    return 0.35;
  }
  const matching = active.filter((order) => order.laundryId === laundryId);
  const ratio = matching.length / active.length;
  const value = ratio + 0.2;
  return Math.max(0, Math.min(1, value));
}

function computeHelperLoad(helperId: string, currentOrders: Order[]) {
  const active = currentOrders.filter(
    (order) => order.status !== "Completed" && order.helperId
  );
  if (active.length === 0) {
    return 0.35;
  }
  const matching = active.filter((order) => order.helperId === helperId);
  const ratio = matching.length / active.length;
  const value = ratio + 0.2;
  return Math.max(0, Math.min(1, value));
}

function computeFlashHelperStats(
  helpersList: Helper[],
  currentOrders: Order[],
  nowMs: number,
  routingState: RoutingEngineState,
  integrityMap: Record<string, HelperIntegrity>
): FlashHelperStats[] {
  const result: FlashHelperStats[] = [];
  helpersList.forEach((helper) => {
    const helperOrders = currentOrders.filter((order) => order.helperId === helper.id);
    let totalEngaged = 0;
    let totalTarget = 0;
    let count = 0;
    helperOrders.forEach((order) => {
      const house = houseClients.find((item) => item.id === order.houseId);
      const laundry = laundryLocations.find((item) => item.id === order.laundryId);
      const profile = computeOrderEngagementProfile({
        order,
        nowMs,
        house,
        laundry,
        allOrders: currentOrders,
      });
      totalEngaged += profile.engagedMinutes;
      totalTarget += profile.targetMinutes;
      count += 1;
    });
    const avgEngaged = count > 0 ? totalEngaged / count : 50;
    const avgTarget = count > 0 ? totalTarget / count : 60;
    const ratio = avgTarget > 0 ? avgEngaged / avgTarget : 1;
    let foldingScore = 1;
    if (ratio > 0) {
      const normalized = Math.max(0.3, Math.min(1.7, ratio));
      foldingScore = 1 / normalized;
    }
    const assignments = routingState.assignments.filter(
      (entry) => entry.helperId === helper.id
    );
    let totalEta = 0;
    let etaCount = 0;
    assignments.forEach((entry) => {
      const eta = routingState.rescueEtaSeconds[entry.orderId];
      if (typeof eta === "number" && eta > 0) {
        totalEta += eta;
        etaCount += 1;
      }
    });
    const avgEta = etaCount > 0 ? totalEta / etaCount : 120;
    const cappedEta = Math.max(10, Math.min(300, avgEta));
    const rescueScore = 1 - (cappedEta - 10) / (300 - 10);
    const portrait = integrityMap[helper.id];
    const integrityScore = portrait ? portrait.score / 100 : 1;
    const combinedScore =
      0.5 * foldingScore + 0.3 * rescueScore + 0.2 * integrityScore;
    result.push({
      helper,
      foldingScore,
      rescueScore,
      combinedScore,
      avgEngagedMinutes: avgEngaged,
      avgTargetMinutes: avgTarget,
      avgRescueEtaSeconds: avgEta,
    });
  });
  return result;
}

function computePremiumHelperStats(
  helpersList: Helper[],
  currentOrders: Order[],
  integrityMap: Record<string, HelperIntegrity>
): PremiumHelperStats[] {
  const completed = currentOrders.filter((order) => order.status === "Completed");
  const result: PremiumHelperStats[] = [];
  helpersList.forEach((helper) => {
    const helperOrders = completed.filter((order) => order.helperId === helper.id);
    const total = helperOrders.length;
    let neatCount = 0;
    helperOrders.forEach((order) => {
      const rating = typeof order.rating === "number" ? order.rating : 5;
      const reason = order.ratingReason ?? "";
      const negative =
        rating < 4 ||
        reason.includes("Poor folding") ||
        reason.includes("No fragrance");
      if (!negative) {
        neatCount += 1;
      }
    });
    const neatnessScore = total > 0 ? neatCount / total : 1;
    const portrait = integrityMap[helper.id];
    const integrityScore = portrait ? portrait.score / 100 : 1;
    const strikes = portrait ? portrait.strikes : 0;
    const qualityScore = 0.6 * neatnessScore + 0.4 * integrityScore;
    result.push({
      helper,
      neatnessScore,
      integrityScore,
      qualityScore,
      strikes,
    });
  });
  return result;
}

function computeBaseEfficiency(plan: PlanId, history: PlanHistoryEntry[]) {
  let base = 0.86;
  if (plan === "Eco") {
    base = 0.8;
  }
  if (plan === "Premium") {
    base = 0.9;
  }
  const count = history.filter((item) => item.plan === plan).length;
  const bonus = Math.min(0.08, count * 0.02);
  const value = base + bonus;
  return Math.max(0.6, Math.min(0.98, value));
}

async function fetchRoute(
  mapboxToken: string,
  points: [number, number][]
): Promise<[number, number][]> {
  const coordinatesParam = points.map((point) => `${point[0]},${point[1]}`).join(";");
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesParam}?geometries=geojson&overview=full&access_token=${encodeURIComponent(
    mapboxToken
  )}`;

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    routes?: { geometry?: { coordinates?: [number, number][] } }[];
  };

  const route = data.routes?.[0]?.geometry?.coordinates;
  if (!route || route.length === 0) {
    return [];
  }

  return route;
}

function createOrUpdateRouteSource(
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

function ensureRouteLayer(map: mapboxgl.Map, id: string, zIndexOrder: string[]) {
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

function createOrUpdateReturnBufferZone(
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

function clearReturnBufferZone(map: mapboxgl.Map) {
  const layerId = "return-buffer-line";
  const sourceId = "return-buffer";
  if (map.getLayer(layerId)) {
    map.removeLayer(layerId);
  }
  if (map.getSource(sourceId)) {
    map.removeSource(sourceId);
  }
}

function createCarMarkerElement() {
  const wrapper = document.createElement("div");
  const element = document.createElement("div");
  element.className = "vehicle-marker-svg";
  element.innerHTML = createTopDownVehicleSvg("#3B82F6");
  wrapper.appendChild(element);
  return { wrapper, element };
}

function createOrUpdateQueuedSpiderLines(map: mapboxgl.Map, orders: Order[]) {
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

function createOrUpdateRescueSpiderLines(map: mapboxgl.Map, state: RoutingEngineState) {
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

function startLaundryProcessingAnimation(
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

function startHouseArrivalAnimation(element: HTMLDivElement | null, durationMs: number) {
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

function createCountdownMarkerElement(durationMs: number) {
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

function animateMarkerAlongRoute(
  map: mapboxgl.Map,
  marker: mapboxgl.Marker,
  coordinates: [number, number][],
  options: {
    durationMs: number;
    phase: TelemetrySnapshot["phase"];
    carId: string;
    onTelemetry?: (snapshot: TelemetrySnapshot) => void;
    mountAtCoordinate?: [number, number];
    mountElement?: HTMLDivElement | null;
    headingElement?: HTMLDivElement | null;
    onReachMount?: () => void;
    onCameraUpdate?: (lng: number, lat: number) => void;
    hideMountOnReach?: boolean;
  }
) {
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
          carId,
          lat,
          lng,
          speedKmh,
          phase,
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

function createCameraFollowHandler(
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

async function runOrderSimulation(
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

function useSystemClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return {
    date: dateFormatter.format(now),
    time: timeFormatter.format(now),
  };
}

function SystemClock() {
  const { date, time } = useSystemClock();

  return (
    <div className="flex flex-col items-center justify-center text-xs sm:text-sm text-slate-100/80 tracking-[0.2em] uppercase">
      <span className="font-medium">{time}</span>
      <span className="text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.3em]">
        {date}
      </span>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-2xl bg-muted-coral/15 border border-muted-coral/70 flex items-center justify-center text-muted-coral text-lg font-semibold shadow-[0_0_24px_rgba(255,127,80,0.55)]">
        S
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs sm:text-sm font-semibold tracking-[0.35em] text-muted-coral">
          SYLPHOLD
        </span>
        <span className="text-[0.6rem] sm:text-[0.7rem] text-slate-300/80 tracking-[0.22em]">
          REALTIME SYSTEM CONSOLE
        </span>
      </div>
    </div>
  );
}

function GlassPanel(props: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-white/5 border border-white/10 shadow-glass backdrop-blur-2xl">
      <div className="absolute inset-0 pointer-events-none opacity-60 mix-blend-screen bg-[radial-gradient(circle_at_0%_0%,rgba(255,127,80,0.22),transparent_45%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.16),transparent_45%)]" />
      <div className="relative px-5 sm:px-7 pt-4 pb-4 sm:pb-5 flex flex-col gap-3">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xs sm:text-sm font-semibold tracking-[0.25em] text-slate-100 uppercase">
              {props.title}
            </h2>
            {props.subtitle ? (
              <p className="mt-1 text-[0.65rem] sm:text-xs text-slate-400 tracking-[0.16em] uppercase">
                {props.subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-[0.55rem] sm:text-[0.6rem] text-slate-400 tracking-[0.22em]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
            <span>LIVE</span>
          </div>
        </header>
        {props.children ? (
          <div className="mt-1 text-[0.7rem] sm:text-xs text-slate-200/90">{props.children}</div>
        ) : null}
      </div>
    </section>
  );
}

function MapPlaceholder(props: {
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

      const createLaundrySvg = () =>
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 11L12 7.5 16 9.3 20 7.5 23.5 11 21.5 12.8 20.6 12.2V24H11.4V12.2L8.5 11z" fill="#C4B5FD" stroke="#7C3AED" stroke-width="1.1" stroke-linejoin="round" /><path d="M12 7.5c0.5 0.7 1.3 1.2 2 1.2s1.5-0.5 2-1.2" fill="none" stroke="#4C1D95" stroke-width="0.9" stroke-linecap="round" /></svg>';

      const createHouseSvg = () =>
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><polygon points="6,16 16,6 26,16 26,26 6,26" fill="#020617" /><polygon points="8,16 16,8 24,16 24,24 8,24" fill="#FBBF24" /><rect x="14" y="18" width="4" height="6" fill="#020617" /></svg>';

      const createHelperSvg = () =>
        '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="11" r="4" fill="#22C55E" /><path d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="#22C55E"/><path d="M10 24c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="#111827" stroke-width="1.5" stroke-linecap="round" /></svg>';

      const createVehicleSvg = () =>
        createTopDownVehicleSvg("#3B82F6");

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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(56,189,248,0.25),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(56,189,248,0.18),transparent_50%)] opacity-80" />
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

function App() {
  const [orders, setOrders] = useState<Order[]>(() => {
    const initial: Order[] = [];
    for (let index = 0; index < 5; index += 1) {
      const house = houseClients[Math.floor(Math.random() * houseClients.length)];
      const laundry = laundryLocations[Math.floor(Math.random() * laundryLocations.length)];
      const helper = helpers[Math.floor(Math.random() * helpers.length)];

      const machineFailed = Math.random() < 0.05;
      const secondCycleUnlocked = machineFailed;
      const rating = Math.random() < 0.2 ? 2 : 5;

      initial.push({
        id: `ord_init_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
        createdAt: Date.now(),
        status: "Queued",
        houseId: house.id,
        laundryId: laundry.id,
        helperId: helper.id,
        machineFailed,
        secondCycleUnlocked,
        rating,
        media: createMockOrderMedia(),
      });
    }
    return initial;
  });
  const [autoSim, setAutoSim] = useState(true);
  const [decisionPhase, setDecisionPhase] = useState<
    "idle" | "loading" | "options" | "running" | "completed"
  >("idle");
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [weights, setWeights] = useState<WeightConfig>({
    distance: 50,
    load: 0,
    efficiency: 20,
  });
  const [helperIntegrity, setHelperIntegrity] = useState<Record<string, HelperIntegrity>>(() => {
    const initial: Record<string, HelperIntegrity> = {};
    helpers.forEach((helper) => {
      initial[helper.id] = { score: 100, strikes: 0, highValueEligible: true };
    });
    return initial;
  });
  const [accountedOrders, setAccountedOrders] = useState<Record<string, boolean>>({});
  const [routingEngineState, setRoutingEngineState] = useState<RoutingEngineState>(() => ({
    assignments: [],
    assetStatus: {},
    rescueEtaSeconds: {},
    searchRadiusKm: {},
    rescueBonusMultiplier: {},
    trunkUnlocked: {},
  }));
  const [stressTestMode, setStressTestMode] = useState(false);
  const [homeMode, setHomeMode] = useState(false);
  const [laundryFailureMode, setLaundryFailureMode] = useState(false);
  const [serviceException, setServiceException] = useState<string | null>(null);
  const helperSim = useHelperSimulation({
    initialActive: Math.min(10, helpers.length),
    minActive: Math.min(8, helpers.length),
    maxActive: Math.min(12, helpers.length),
  });
  const [planMetrics, setPlanMetrics] = useState<PlanMetrics[] | null>(null);
  const [planHistory, setPlanHistory] = useState<PlanHistoryEntry[]>([]);
  const simulationContextRef = useRef<{
    map: mapboxgl.Map;
    laundryMarkers: MarkerWithElement[];
    houseMarkers: MarkerWithElement[];
    helperMarkers: MarkerWithElement[];
    vehicleMarkers: MarkerWithElement[];
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [followDebug, setFollowDebug] = useState<{
    carId: string;
    lat: number;
    lng: number;
    phase: TelemetrySnapshot["phase"];
    outOfView: string[];
  } | null>(null);

  useEffect(() => {
    if (!orders.length) {
      return;
    }
    const completed = orders.filter(
      (order) => order.status === "Completed" && !accountedOrders[order.id]
    );
    if (!completed.length) {
      return;
    }
    setAccountedOrders((previous) => {
      const next = { ...previous };
      completed.forEach((order) => {
        next[order.id] = true;
      });
      return next;
    });
    setHelperIntegrity((previous) => {
      const next = { ...previous };
      completed.forEach((order) => {
        if (!order.helperId) {
          return;
        }
        const reason = order.ratingReason ?? "";
        const negative =
          reason.includes("Poor folding") || reason.includes("No fragrance");
        if (!negative) {
          return;
        }
        const current = next[order.helperId] ?? {
          score: 100,
          strikes: 0,
          highValueEligible: true,
        };
        const score = Math.max(0, current.score - 10);
        const strikes = current.strikes + 1;
        const highValueEligible = score >= 70 && strikes < 3;
        next[order.helperId] = { score, strikes, highValueEligible };
      });
      return next;
    });
  }, [orders, accountedOrders]);

  useEffect(() => {
    if (!autoSim) {
      return;
    }

    let timeoutId: number;

    const scheduleNext = () => {
      const delay = 45000 + Math.random() * 30000;
      timeoutId = window.setTimeout(() => {
        const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        setOrders((previous) => {
          if (!houseClients.length || !laundryLocations.length || !helpers.length) {
            return previous;
          }

          let helper = helpers[Math.floor(Math.random() * helpers.length)];
          let house = houseClients[Math.floor(Math.random() * houseClients.length)];
          let laundry =
            laundryLocations[Math.floor(Math.random() * laundryLocations.length)];

          if (homeMode) {
            const homeTarget = helperHomeTargets[helper.id];
            if (homeTarget) {
              let attempts = 0;
              while (attempts < 8) {
                const candidateHouse =
                  houseClients[Math.floor(Math.random() * houseClients.length)];
                const candidateLaundry =
                  laundryLocations[Math.floor(Math.random() * laundryLocations.length)];
                const onRouteHouse = isOnRouteHome(
                  helper.coordinates,
                  homeTarget,
                  candidateHouse.coordinates
                );
                const onRouteLaundry = isOnRouteHome(
                  helper.coordinates,
                  homeTarget,
                  candidateLaundry.coordinates
                );
                if (onRouteHouse || onRouteLaundry) {
                  house = candidateHouse;
                  laundry = candidateLaundry;
                  break;
                }
                attempts += 1;
              }
          }
        }

        const machineFailed = Math.random() < 0.05;
        const secondCycleUnlocked = machineFailed;
        const rating = Math.random() < 0.2 ? 2 : 5;

        const order: Order = {
          id: orderId,
          createdAt: Date.now(),
          status: "Queued",
          houseId: house.id,
          laundryId: laundry.id,
          helperId: helper.id,
          machineFailed,
          secondCycleUnlocked,
          homeModeAtCreation: homeMode,
          rating,
          ratingReason:
            typeof rating === "number" && rating < 3
              ? Math.random() < 0.5
                ? "Poor folding"
                : "No fragrance"
              : undefined,
          media: createMockOrderMedia(),
        };

          return [...previous, order].slice(-40);
        });
        if (stressTestMode) {
          const baseVehicle = vehicles[1] ?? vehicles[0];
          const location =
            baseVehicle?.coordinates ?? laundryLocations[0]?.coordinates ?? [-122.08, 37.39];
          const availableHelpers: HelperSimEntry[] = [
            { id: "helper_01", status: "available", active: true },
            { id: "helper_02", status: "available", active: true },
            { id: "helper_03", status: "available", active: true },
          ];
          setRoutingEngineState((previousState) => {
            const event: CollisionEvent = {
              id: `collision_${orderId}`,
              orderId,
              vehicleId: baseVehicle?.id ?? "vehicle_02",
              timestamp: Date.now(),
              location,
            };

            const first = handleCollisionWithRecursiveDispatch(previousState, event, {
              helperId: "helper_01",
              helperAtLaundry: false,
              availableHelpers,
            });
            const second = handleCollisionWithRecursiveDispatch(first, event, {
              helperId: "helper_02",
              helperAtLaundry: false,
              availableHelpers,
            });
            const third = handleCollisionWithRecursiveDispatch(second, event, {
              helperId: "helper_01",
              helperAtLaundry: true,
              availableHelpers,
            });
            const completed = markAssetTransferCompleted(third, event.orderId);
            return completed;
          });
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoSim, homeMode, stressTestMode]);

  useEffect(() => {
    if (decisionPhase !== "loading") {
      return;
    }

    const id = window.setTimeout(() => {
      setDecisionPhase("options");
    }, 1600);

    return () => {
      window.clearTimeout(id);
    };
  }, [decisionPhase]);

  useEffect(() => {
    const context = simulationContextRef.current;
    if (!context) {
      return;
    }
    syncHelperMarkersWithSimulation(context, helperSim.helpers);
  }, [helperSim.helpers]);

  useEffect(() => {
    const context = simulationContextRef.current;
    if (!context) {
      return;
    }
    syncVehicleMarkersWithAssetStatus(context, routingEngineState);
  }, [routingEngineState]);

  useEffect(() => {
    const context = simulationContextRef.current;
    if (!context) {
      return;
    }
    if (!homeMode) {
      context.houseMarkers.forEach(({ element }) => {
        element.style.opacity = "1";
        element.style.filter = "none";
      });
      clearReturnBufferZone(context.map);
      return;
    }
    const primaryHelper = helpers[0];
    const homeTarget = helperHomeTargets[primaryHelper.id];
    if (!primaryHelper || !homeTarget) {
      return;
    }
     createOrUpdateReturnBufferZone(context.map, primaryHelper.coordinates, homeTarget);
    context.houseMarkers.forEach(({ element, id }) => {
      const house = houseClients.find((item) => item.id === id);
      if (!house) {
        return;
      }
      const onRoute = isOnRouteHome(
        primaryHelper.coordinates,
        homeTarget,
        house.coordinates
      );
      if (onRoute) {
        element.style.opacity = "1";
        element.style.filter = "none";
      } else {
        element.style.opacity = "0.15";
        element.style.filter = "grayscale(1)";
      }
    });
  }, [homeMode]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (decisionPhase === "options") {
      recomputePlanMetrics();
    }
    if (decisionPhase === "idle") {
      setPlanMetrics(null);
    }
  }, [decisionPhase, orders, weights, planHistory]);

  const totalOrders = orders.length;
  const activeOrders = orders.filter((order) => order.status !== "Completed").length;
  const completedOrders = orders.filter((order) => order.status === "Completed").length;

  const hasActiveOrders = activeOrders > 0;
  const hasCompletedOrders = completedOrders > 0;

  const decisionStateLabel = (() => {
    if (decisionPhase === "loading") {
      return "Computing paths";
    }
    if (decisionPhase === "options") {
      return "Generating optimally weighted options";
    }
    if (decisionPhase === "running") {
      return "Order processing";
    }
    if (decisionPhase === "completed") {
      return "Delivery completed";
    }
    if (hasActiveOrders && !hasCompletedOrders) {
      return "Order processing";
    }
    if (!hasActiveOrders && hasCompletedOrders) {
      return "Order completed";
    }
    return "Idle";
  })();

  const queuedCount = orders.filter((order) => order.status === "Queued").length;
  const pickingUpCount = orders.filter((order) => order.status === "PickingUp").length;
  const processingCount = orders.filter((order) => order.status === "Processing").length;
  const deliveringCount = orders.filter((order) => order.status === "Delivering").length;

  const selectPlanEntities = (plan: PlanId) => {
    if (plan === "Flash") {
      if (!helpers.length || !houseClients.length || !laundryLocations.length) {
        return {
          carAStart: undefined,
          carBStart: undefined,
          helper: helpers[0],
          client: houseClients[0],
          laundry: laundryLocations[0],
        };
      }
      const stats = computeFlashHelperStats(
        helpers,
        orders,
        now,
        routingEngineState,
        helperIntegrity
      );
      let bestHelper = helpers[0];
      if (stats.length > 0) {
        const eligible = stats.filter(
          (item) => item.combinedScore * 100 > 90
        );
        const pool = eligible.length > 0 ? eligible : stats;
        const bestStats = pool.reduce((best, item) =>
          item.combinedScore > best.combinedScore ? item : best
        );
        bestHelper = bestStats.helper;
      }
      const helperOrders = orders.filter(
        (order) => order.status !== "Completed" && order.helperId === bestHelper.id
      );
      let client: HouseClient | null = null;
      let laundry: LaundryLocation | null = null;
      if (helperOrders.length > 0) {
        const anchorOrder = helperOrders[helperOrders.length - 1];
        client =
          houseClients.find((item) => item.id === anchorOrder.houseId) ?? null;
        laundry =
          laundryLocations.find((item) => item.id === anchorOrder.laundryId) ??
          null;
      }
      if (!client) {
        client = houseClients.reduce((best, candidate) => {
          const currentDistance = haversineDistanceKm(
            candidate.coordinates,
            bestHelper.coordinates
          );
          const bestDistance = haversineDistanceKm(
            best.coordinates,
            bestHelper.coordinates
          );
          return currentDistance < bestDistance ? candidate : best;
        });
      }
      if (!laundry) {
        laundry = laundryLocations.reduce((best, candidate) => {
          const currentDistance = haversineDistanceKm(
            candidate.coordinates,
            client.coordinates
          );
          const bestDistance = haversineDistanceKm(
            best.coordinates,
            client.coordinates
          );
          return currentDistance < bestDistance ? candidate : best;
        });
      }
      const sortedVehicles =
        vehicles.length > 0
          ? [...vehicles].sort((a, b) => {
              const aDistance = haversineDistanceKm(
                a.coordinates,
                bestHelper.coordinates
              );
              const bDistance = haversineDistanceKm(
                b.coordinates,
                bestHelper.coordinates
              );
              return aDistance - bDistance;
            })
          : vehicles;
      const carAStart = sortedVehicles[0]?.coordinates;
      const carBStart = sortedVehicles[1]?.coordinates ?? sortedVehicles[0]?.coordinates;

      return {
        carAStart,
        carBStart,
        helper: bestHelper,
        client,
        laundry,
      };
    }

    if (plan === "Eco") {
      if (!helpers.length || !houseClients.length || !laundryLocations.length) {
        return {
          carAStart: vehicles[2]?.coordinates ?? vehicles[0]?.coordinates,
          carBStart: vehicles[3]?.coordinates ?? vehicles[1]?.coordinates,
          helper: helpers[1] ?? helpers[0],
          client: houseClients[houseClients.length - 1] ?? houseClients[0],
          laundry: laundryLocations[1] ?? laundryLocations[0],
        };
      }

      let bestWithinThreshold:
        | {
            helper: Helper;
            client: HouseClient;
            laundry: LaundryLocation;
            detourRatio: number;
          }
        | null = null;
      let bestOverall:
        | {
            helper: Helper;
            client: HouseClient;
            laundry: LaundryLocation;
            detourRatio: number;
          }
        | null = null;

      helpers.forEach((helper) => {
        const home = houseClients.reduce((best, candidate) => {
          const currentDistance = haversineDistanceKm(
            candidate.coordinates,
            helper.coordinates
          );
          const bestDistance = haversineDistanceKm(
            best.coordinates,
            helper.coordinates
          );
          return currentDistance < bestDistance ? candidate : best;
        });
        const homeCoordinates = home.coordinates;
        houseClients.forEach((client) => {
          laundryLocations.forEach((laundry) => {
            const directHomeDistanceKm = haversineDistanceKm(
              helper.coordinates,
              homeCoordinates
            );
            if (directHomeDistanceKm === 0) {
              return;
            }
            const withOrderDistanceKm =
              haversineDistanceKm(helper.coordinates, client.coordinates) +
              haversineDistanceKm(client.coordinates, laundry.coordinates) +
              haversineDistanceKm(laundry.coordinates, homeCoordinates);
            const detourRatio = Math.max(
              0,
              (withOrderDistanceKm - directHomeDistanceKm) / directHomeDistanceKm
            );
            if (!bestOverall || detourRatio < bestOverall.detourRatio) {
              bestOverall = {
                helper,
                client,
                laundry,
                detourRatio,
              };
            }
            if (detourRatio < 0.1) {
              if (
                !bestWithinThreshold ||
                detourRatio < bestWithinThreshold.detourRatio
              ) {
                bestWithinThreshold = {
                  helper,
                  client,
                  laundry,
                  detourRatio,
                };
              }
            }
          });
        });
      });

      const chosen =
        (bestWithinThreshold ?? bestOverall) as
          | {
              helper: Helper;
              client: HouseClient;
              laundry: LaundryLocation;
              detourRatio: number;
            }
          | null;
      if (!chosen) {
        return {
          carAStart: vehicles[2]?.coordinates ?? vehicles[0]?.coordinates,
          carBStart: vehicles[3]?.coordinates ?? vehicles[1]?.coordinates,
          helper: helpers[1] ?? helpers[0],
          client: houseClients[houseClients.length - 1] ?? houseClients[0],
          laundry: laundryLocations[1] ?? laundryLocations[0],
        };
      }

      const sortedVehicles =
        vehicles.length > 0
          ? [...vehicles].sort((a, b) => {
              const aDistance = haversineDistanceKm(
                a.coordinates,
                chosen.helper.coordinates
              );
              const bDistance = haversineDistanceKm(
                b.coordinates,
                chosen.helper.coordinates
              );
              return aDistance - bDistance;
            })
          : vehicles;

      const carAStart = sortedVehicles[2]?.coordinates ?? sortedVehicles[0]?.coordinates;
      const carBStart =
        sortedVehicles[3]?.coordinates ?? sortedVehicles[1]?.coordinates ?? carAStart;

      return {
        carAStart,
        carBStart,
        helper: chosen.helper,
        client: chosen.client,
        laundry: chosen.laundry,
      };
    }

    if (!helpers.length || !houseClients.length || !laundryLocations.length) {
      return {
        carAStart: vehicles[4]?.coordinates ?? vehicles[0]?.coordinates,
        carBStart: vehicles[5]?.coordinates ?? vehicles[1]?.coordinates,
        helper: helpers[0],
        client: houseClients[0],
        laundry: laundryLocations[0],
      };
    }

    const premiumStats = computePremiumHelperStats(helpers, orders, helperIntegrity);
    const strictEligible = premiumStats.filter(
      (item) => item.integrityScore > 0.95 && item.neatnessScore === 1
    );
    const zeroComplaint = premiumStats.filter((item) => item.strikes === 0);
    const premiumPool =
      strictEligible.length > 0
        ? strictEligible
        : zeroComplaint.length > 0
        ? zeroComplaint
        : premiumStats;
    const bestPremiumStats = premiumPool.reduce((best, item) =>
      item.qualityScore > best.qualityScore ? item : best
    );
    const bestHelper = bestPremiumStats.helper;
    const helperOrders = orders.filter(
      (order) => order.status !== "Completed" && order.helperId === bestHelper.id
    );
    let client: HouseClient | null = null;
    let laundry: LaundryLocation | null = null;
    if (helperOrders.length > 0) {
      const anchorOrder = helperOrders[helperOrders.length - 1];
      client =
        houseClients.find((item) => item.id === anchorOrder.houseId) ?? null;
      laundry =
        laundryLocations.find((item) => item.id === anchorOrder.laundryId) ??
        null;
    }
    if (!client) {
      client = houseClients.reduce((best, candidate) => {
        const currentDistance = haversineDistanceKm(
          candidate.coordinates,
          bestHelper.coordinates
        );
        const bestDistance = haversineDistanceKm(
          best.coordinates,
          bestHelper.coordinates
        );
        return currentDistance < bestDistance ? candidate : best;
      });
    }
    if (!laundry) {
      laundry = laundryLocations.reduce((best, candidate) => {
        const currentDistance = haversineDistanceKm(
          candidate.coordinates,
          client.coordinates
        );
        const bestDistance = haversineDistanceKm(
          best.coordinates,
          client.coordinates
        );
        return currentDistance < bestDistance ? candidate : best;
      });
    }

    const sortedVehicles =
      vehicles.length > 0
        ? [...vehicles].sort((a, b) => {
            const aDistance = haversineDistanceKm(
              a.coordinates,
              bestHelper.coordinates
            );
            const bDistance = haversineDistanceKm(
              b.coordinates,
              bestHelper.coordinates
            );
            return aDistance - bDistance;
          })
        : vehicles;

    const carAStart = sortedVehicles[4]?.coordinates ?? sortedVehicles[0]?.coordinates;
    const carBStart = sortedVehicles[5]?.coordinates ?? sortedVehicles[1]?.coordinates ?? carAStart;

    return {
      carAStart,
      carBStart,
      helper: bestHelper,
      client,
      laundry,
    };
  };

  const recomputePlanMetrics = () => {
    if (decisionPhase !== "options") {
      return;
    }

    const totalWeight = weights.distance + weights.efficiency || 1;
    const distanceWeight = weights.distance / totalWeight;
    const efficiencyWeight = weights.efficiency / totalWeight;
    const nowMs = now;
    const flashStats = computeFlashHelperStats(
      helpers,
      orders,
      nowMs,
      routingEngineState,
      helperIntegrity
    );
    const premiumStats = computePremiumHelperStats(
      helpers,
      orders,
      helperIntegrity
    );
    const eligibleFlash = flashStats.filter(
      (item) => item.combinedScore * 100 > 90
    );
    const flashPool =
      eligibleFlash.length > 0 ? eligibleFlash : flashStats;
    const bestFlashStats =
      flashPool.length > 0
        ? flashPool.reduce((best, item) =>
            item.combinedScore > best.combinedScore ? item : best
          )
        : null;
    const strictPremiumEligible = premiumStats.filter(
      (item) => item.integrityScore > 0.95 && item.neatnessScore === 1
    );
    const zeroComplaintPremium = premiumStats.filter(
      (item) => item.strikes === 0
    );
    const premiumPool =
      strictPremiumEligible.length > 0
        ? strictPremiumEligible
        : zeroComplaintPremium.length > 0
        ? zeroComplaintPremium
        : premiumStats;
    const bestPremiumStats =
      premiumPool.length > 0
        ? premiumPool.reduce((best, item) =>
            item.qualityScore > best.qualityScore ? item : best
          )
        : null;

    const plans: PlanId[] = ["Flash", "Eco", "Premium"];
    const metrics: PlanMetrics[] = [];

    plans.forEach((planId) => {
      const entities = selectPlanEntities(planId);
      const { carAStart, carBStart, helper, client, laundry } = entities;

      if (!carAStart || !carBStart || !helper || !client || !laundry) {
        return;
      }

      const legs: [number, number][][] = [
        [carAStart, helper.coordinates],
        [helper.coordinates, laundry.coordinates],
        [carBStart, client.coordinates],
        [client.coordinates, laundry.coordinates],
        [laundry.coordinates, client.coordinates],
      ];

      let totalDistanceKm = 0;
      legs.forEach((pair) => {
        totalDistanceKm += haversineDistanceKm(pair[0], pair[1]);
      });

      let estimatedMinutes = (totalDistanceKm / 30) * 60;
      const laundryLoad = computeLaundryLoad(laundry.id, orders);
      const helperLoad = computeHelperLoad(helper.id, orders);
      let efficiency = computeBaseEfficiency(planId, planHistory);

      if (planId === "Flash" && bestFlashStats) {
        const effBase = Math.max(0.8, Math.min(1, bestFlashStats.combinedScore));
        const effScaled = 0.95 + ((effBase - 0.8) / 0.2) * (0.99 - 0.95);
        efficiency = Math.max(0.95, Math.min(0.99, effScaled));
        const engagedBaseline =
          bestFlashStats.avgEngagedMinutes > 0
            ? bestFlashStats.avgEngagedMinutes
            : estimatedMinutes;
        estimatedMinutes = Math.min(estimatedMinutes, engagedBaseline * 0.85);
      }

      let guaranteeAdjustment = 0.5;
      const helperHomeCoordinates =
        houseClients.length > 0
          ? houseClients.reduce((best, candidate) => {
              const currentDistance = haversineDistanceKm(
                candidate.coordinates,
                helper.coordinates
              );
              const bestDistance = haversineDistanceKm(
                best.coordinates,
                helper.coordinates
              );
              return currentDistance < bestDistance ? candidate : best;
            }).coordinates
          : helper.coordinates;
      const directHomeDistanceKm = haversineDistanceKm(
        helper.coordinates,
        helperHomeCoordinates
      );
      const withOrderDistanceKm =
        haversineDistanceKm(helper.coordinates, client.coordinates) +
        haversineDistanceKm(client.coordinates, laundry.coordinates) +
        haversineDistanceKm(laundry.coordinates, helperHomeCoordinates);
      if (directHomeDistanceKm > 0) {
        const detourRatio = Math.max(
          0,
          (withOrderDistanceKm - directHomeDistanceKm) / directHomeDistanceKm
        );
        guaranteeAdjustment = Math.max(
          0,
          Math.min(1, detourRatio / (planId === "Eco" ? 0.1 : 0.3))
        );
      }

      metrics.push({
        id: planId,
        label: planId,
        totalDistanceKm,
        estimatedMinutes,
        laundryLoad,
        helperLoad,
        efficiency,
        chainOfCustodyScore: 0,
        faultRecoveryScore: 0,
        compositeScore: 0,
        guaranteeAdjustment,
      });
    });

    if (!metrics.length) {
      setPlanMetrics(null);
      return;
    }

    const maxDistance = metrics.reduce(
      (max, item) => (item.totalDistanceKm > max ? item.totalDistanceKm : max),
      metrics[0].totalDistanceKm
    );
    const minDistance = metrics.reduce(
      (min, item) => (item.totalDistanceKm < min ? item.totalDistanceKm : min),
      metrics[0].totalDistanceKm
    );

    const updated = metrics.map((item) => {
      let distanceScore = 1;
      if (maxDistance !== minDistance) {
        distanceScore =
          1 - (item.totalDistanceKm - minDistance) / (maxDistance - minDistance);
      }
      const avgLoad = (item.laundryLoad + item.helperLoad) / 2;
      let chainOfCustodyScore = Math.max(
        0,
        Math.min(1, 0.6 * distanceScore + 0.4 * (1 - avgLoad))
      );
      const activeHelperRatio =
        helpers.length > 0 ? helperSim.activeHelpers.length / helpers.length : 0;
      let faultRecoveryScore = Math.max(
        0,
        Math.min(1, 0.5 * activeHelperRatio + 0.5 * (1 - avgLoad))
      );
      if (item.id === "Flash" && bestFlashStats) {
        const eta = Math.max(10, Math.min(300, bestFlashStats.avgRescueEtaSeconds));
        const rescueFactor = 1 - (eta - 10) / (300 - 10);
        faultRecoveryScore = Math.max(faultRecoveryScore, rescueFactor);
      }
      if (item.id === "Premium" && bestPremiumStats) {
        const quality = bestPremiumStats.qualityScore;
        chainOfCustodyScore = Math.max(chainOfCustodyScore, quality);
      }
      let compositeScore =
        0.4 * chainOfCustodyScore +
        0.4 * faultRecoveryScore +
        0.1 * distanceWeight * distanceScore +
        0.1 * efficiencyWeight * item.efficiency;

      if (item.id === "Eco") {
        const guaranteeScore = 1 - item.guaranteeAdjustment;
        compositeScore =
          0.7 * compositeScore + 0.3 * guaranteeScore;
      }

      if (bestFlashStats && bestPremiumStats) {
        const efficiencyOrientation = bestFlashStats.combinedScore;
        const qualityOrientation = bestPremiumStats.qualityScore;
        const diff = qualityOrientation - efficiencyOrientation;
        if (diff > 0.05 && item.id === "Premium") {
          compositeScore = Math.min(1, compositeScore + 0.08);
        }
        if (diff < -0.05 && item.id === "Flash") {
          compositeScore = Math.min(1, compositeScore + 0.08);
        }
      }

      return {
        ...item,
        chainOfCustodyScore,
        faultRecoveryScore,
        compositeScore,
      };
    });

    const premiumIndex = updated.findIndex((item) => item.id === "Premium");
    if (premiumIndex >= 0) {
      const maxCust = updated.reduce(
        (max, item) =>
          item.chainOfCustodyScore > max ? item.chainOfCustodyScore : max,
        0
      );
      const normalized = updated.map((item, index) =>
        index === premiumIndex
          ? {
              ...item,
              chainOfCustodyScore: Math.min(1, Math.max(item.chainOfCustodyScore, maxCust)),
            }
          : item
      );
      setPlanMetrics(normalized);
    } else {
      setPlanMetrics(updated);
    }
  };

  const advanceOrders = () => {
    setOrders((previous) =>
      previous.map((order) => {
        if (order.status === "Completed") {
          return order;
        }

        if (order.status === "Queued") {
          return { ...order, status: "PickingUp" };
        }

        if (order.status === "PickingUp") {
          return { ...order, status: "Processing" };
        }

        if (order.status === "Processing") {
          return { ...order, status: "Delivering" };
        }

        return { ...order, status: "Completed" };
      })
    );
  };

  const createBatchOrders = () => {
    const nextOrders: Order[] = [];
    for (let index = 0; index < 5; index += 1) {
      if (!houseClients.length || !laundryLocations.length || !helpers.length) {
        break;
      }

      let helper = helpers[Math.floor(Math.random() * helpers.length)];
      let house = houseClients[Math.floor(Math.random() * houseClients.length)];
      let laundry =
        laundryLocations[Math.floor(Math.random() * laundryLocations.length)];

      if (homeMode) {
        const homeTarget = helperHomeTargets[helper.id];
        if (homeTarget) {
          let attempts = 0;
          while (attempts < 8) {
            const candidateHouse =
              houseClients[Math.floor(Math.random() * houseClients.length)];
            const candidateLaundry =
              laundryLocations[Math.floor(Math.random() * laundryLocations.length)];
            const onRouteHouse = isOnRouteHome(
              helper.coordinates,
              homeTarget,
              candidateHouse.coordinates
            );
            const onRouteLaundry = isOnRouteHome(
              helper.coordinates,
              homeTarget,
              candidateLaundry.coordinates
            );
            if (onRouteHouse || onRouteLaundry) {
              house = candidateHouse;
              laundry = candidateLaundry;
              break;
            }
            attempts += 1;
          }
        }
      }

      const machineFailed = Math.random() < 0.05;
      const secondCycleUnlocked = machineFailed;
      const rating = Math.random() < 0.2 ? 2 : 5;

      nextOrders.push({
        id: `ord_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
        createdAt: Date.now(),
        status: "Queued",
        houseId: house.id,
        laundryId: laundry.id,
        helperId: helper.id,
        machineFailed,
        secondCycleUnlocked,
        homeModeAtCreation: homeMode,
        rating,
        ratingReason:
          typeof rating === "number" && rating < 3
            ? Math.random() < 0.5
              ? "Poor folding"
              : "No fragrance"
            : undefined,
        media: createMockOrderMedia(),
      });
    }

    setOrders((previous) => [...previous, ...nextOrders].slice(-40));

    if (stressTestMode && nextOrders.length > 0) {
      const baseVehicle = vehicles[1] ?? vehicles[0];
      const location =
        baseVehicle?.coordinates ?? laundryLocations[0]?.coordinates ?? [-122.08, 37.39];
      const availableHelpers: HelperSimEntry[] = [
        { id: "helper_01", status: "available", active: true },
        { id: "helper_02", status: "available", active: true },
        { id: "helper_03", status: "available", active: true },
      ];
      const targetOrder = nextOrders[nextOrders.length - 1];
      setRoutingEngineState((previousState) => {
        const event: CollisionEvent = {
          id: `collision_${targetOrder.id}`,
          orderId: targetOrder.id,
          vehicleId: baseVehicle?.id ?? "vehicle_02",
          timestamp: Date.now(),
          location,
        };

        const first = handleCollisionWithRecursiveDispatch(previousState, event, {
          helperId: "helper_01",
          helperAtLaundry: false,
          availableHelpers,
        });
        const second = handleCollisionWithRecursiveDispatch(first, event, {
          helperId: "helper_02",
          helperAtLaundry: false,
          availableHelpers,
        });
        const third = handleCollisionWithRecursiveDispatch(second, event, {
          helperId: "helper_01",
          helperAtLaundry: true,
          availableHelpers,
        });
        const completed = markAssetTransferCompleted(third, event.orderId);
        return completed;
      });
    }
  };

  const resetOrders = () => {
    setOrders([]);
  };

  const recentOrders = orders.slice(-5).reverse();
  const completedRecentOrders = orders
    .filter((order) => order.status === "Completed")
    .slice(-5)
    .reverse();

  const [mediaModalOrderId, setMediaModalOrderId] = useState<string | null>(null);
  const mediaModalOrder =
    mediaModalOrderId != null
      ? orders.find((order) => order.id === mediaModalOrderId) ?? null
      : null;
  const latestRoutingAssignments = (() => {
    if (!routingEngineState.assignments.length) {
      return [];
    }
    const last = routingEngineState.assignments[routingEngineState.assignments.length - 1];
    const orderId = last.orderId;
    return routingEngineState.assignments.filter((entry) => entry.orderId === orderId);
  })();
  const latestAssetOrderId =
    latestRoutingAssignments.length > 0 ? latestRoutingAssignments[0].orderId : null;
  const latestAssetStatus =
    latestAssetOrderId != null
      ? routingEngineState.assetStatus[latestAssetOrderId] ?? "Pending"
      : null;
  const latestRescueEtaSeconds =
    latestAssetOrderId != null
      ? routingEngineState.rescueEtaSeconds[latestAssetOrderId]
      : undefined;
  const latestRescueAssignment =
    latestRoutingAssignments.length > 0
      ? latestRoutingAssignments[latestRoutingAssignments.length - 1]
      : null;
  const latestRescueEtaLabel =
    typeof latestRescueEtaSeconds === "number"
      ? `${Math.floor(latestRescueEtaSeconds / 60)
          .toString()
          .padStart(2, "0")}:${(latestRescueEtaSeconds % 60).toString().padStart(2, "0")}`
      : null;
  const latestTrunkUnlocked =
    latestAssetOrderId != null
      ? routingEngineState.trunkUnlocked[latestAssetOrderId] === true
      : false;
  const mechanicalOverrideEnabled = stressTestMode && latestTrunkUnlocked;

  const handleGenerateSimulationOrder = () => {
    const context = simulationContextRef.current;
    if (context) {
      context.houseMarkers.forEach(({ element }) => {
        element.style.opacity = "1";
      });
    }
    setSelectedPlan(null);
    setDecisionPhase("loading");
  };

  const startSimulation = (plan: PlanId) => {
    helpersHiddenByOrderSim = false;
    if (lastMissionCarMarker) {
      lastMissionCarMarker.remove();
      lastMissionCarMarker = null;
    }
    setSelectedPlan(plan);
    setDecisionPhase("running");
    setServiceException(laundryFailureMode ? "laundry_failure" : null);

    const context = simulationContextRef.current;
    const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

    if (!context || !token) {
      return;
    }

    const { carAStart, carBStart, helper, client, laundry } = selectPlanEntities(plan);

    if (!carAStart || !carBStart || !helper || !client || !laundry) {
      return;
    }

    const laundryMarkerElement =
      context.laundryMarkers.find((item) => item.id === laundry.id)?.element ?? null;
    const helperMarkerElement =
      context.helperMarkers.find((item) => item.id === helper.id)?.element ?? null;
    const clientMarkerElement =
      context.houseMarkers.find((item) => item.id === client.id)?.element ?? null;

    const matchingMetrics =
      planMetrics?.find((item) => item.id === plan) ?? null;

    if (matchingMetrics) {
      setPlanHistory((previous) => {
        const entry: PlanHistoryEntry = {
          id: `history_${Date.now()}_${plan}`,
          plan,
          timestamp: Date.now(),
          compositeScore: matchingMetrics.compositeScore,
          totalDistanceKm: matchingMetrics.totalDistanceKm,
          estimatedMinutes: matchingMetrics.estimatedMinutes,
        };
        const next = [entry, ...previous];
        return next.slice(0, 12);
      });
    }

    const handleHelperPickup = () => {
      helpersHiddenByOrderSim = true;
      context.helperMarkers.forEach(({ element }) => {
        element.style.opacity = "0";
        element.style.filter = "grayscale(1)";
      });
    };

    const helperHomeCoord =
      plan === "Eco" && houseClients.length > 0
        ? houseClients.reduce((best, candidate) => {
            const currentDistance = haversineDistanceKm(
              candidate.coordinates,
              helper.coordinates
            );
            const bestDistance = haversineDistanceKm(
              best.coordinates,
              helper.coordinates
            );
            return currentDistance < bestDistance ? candidate : best;
          }).coordinates
        : undefined;

    context.houseMarkers.forEach(({ element, id }) => {
      if (id === client.id) {
        element.style.opacity = "1";
        element.style.filter = "none";
      } else {
        element.style.opacity = "0";
      }
    });

    let lastDebugUpdate = 0;

    void runOrderSimulation(
      context.map,
      token,
      {
        carAStart,
        carBStart,
        helperCoord: helper.coordinates,
        clientCoord: client.coordinates,
        laundryCoord: laundry.coordinates,
        helperHomeCoord,
        laundryElement: laundryMarkerElement,
        helperElement: helperMarkerElement,
        clientElement: clientMarkerElement,
        onHelperPickup: handleHelperPickup,
      },
      (snapshot) => {
        const currentContext = simulationContextRef.current;
        if (!currentContext) {
          return;
        }
        if (snapshot.carId !== "CarC") {
          return;
        }
        const nowTime = performance.now();
        if (nowTime - lastDebugUpdate < 200) {
          return;
        }
        lastDebugUpdate = nowTime;
        const bounds = currentContext.map.getBounds() as mapboxgl.LngLatBounds;
        const outOfView: string[] = [];
        const carInView = bounds.contains([snapshot.lng, snapshot.lat]);
        if (!carInView) {
          outOfView.push("mission-car");
        }
        const laundryInView = bounds.contains(laundry.coordinates);
        if (!laundryInView) {
          outOfView.push("laundry-hub");
        }
        const clientInView = bounds.contains(client.coordinates);
        if (!clientInView) {
          outOfView.push("customer");
        }
        const helperInView = bounds.contains(helper.coordinates);
        if (!helperInView) {
          outOfView.push("helper-node");
        }
        setFollowDebug({
          carId: snapshot.carId,
          lat: snapshot.lat,
          lng: snapshot.lng,
          phase: snapshot.phase,
          outOfView,
        });
      },
      true,
      plan,
      laundryFailureMode
    ).then(() => {
      context.houseMarkers.forEach(({ element }) => {
        element.style.opacity = "1";
      });
      helpersHiddenByOrderSim = false;
      syncHelperMarkersWithSimulation(context, helperSim.helpers);
      setDecisionPhase("completed");
    });
  };

  const totalWeightValue = weights.distance + weights.efficiency || 1;
  const distanceWeightPercent = Math.round(
    (weights.distance / totalWeightValue) * 100
  );
  const efficiencyWeightPercent = Math.round(
    (weights.efficiency / totalWeightValue) * 100
  );

  const metricsById = planMetrics
    ? planMetrics.reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {} as Record<PlanId, PlanMetrics>)
    : null;

  let lowestGuaranteePlanId: PlanId | null = null;
  if (planMetrics && planMetrics.length > 0) {
    const lowest = planMetrics.reduce((best, item) =>
      item.guaranteeAdjustment < best.guaranteeAdjustment ? item : best
    );
    lowestGuaranteePlanId = lowest.id;
  }

  let premiumTrustScore: number | null = null;
  if (helpers.length > 0) {
    const premiumStats = computePremiumHelperStats(
      helpers,
      orders,
      helperIntegrity
    );
    if (premiumStats.length > 0) {
      const zeroComplaint = premiumStats.filter((item) => item.strikes === 0);
      const pool = zeroComplaint.length > 0 ? zeroComplaint : premiumStats;
      const best = pool.reduce((current, item) =>
        item.qualityScore > current.qualityScore ? item : current
      );
      const integrity = helperIntegrity[best.helper.id];
      premiumTrustScore = integrity ? integrity.score : null;
    }
  }

  const flashMetrics = metricsById ? metricsById.Flash : null;
  const ecoMetrics = metricsById ? metricsById.Eco : null;
  const premiumMetrics = metricsById ? metricsById.Premium : null;

  const bestPlan =
    planMetrics && planMetrics.length > 0
      ? planMetrics.reduce((currentBest, item) =>
          item.compositeScore > currentBest.compositeScore ? item : currentBest
        )
      : null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background text-slate-50 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 binary-stream mix-blend-screen opacity-60" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-2xl shadow-glass">
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
              <Logo />
              <div className="hidden md:block flex-1">
                <SystemClock />
              </div>
              <div className="flex items-center gap-3 text-[0.6rem] sm:text-[0.7rem] tracking-[0.18em] text-slate-300 uppercase">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)]" />
                <span>SYLPHOLD CORE ONLINE</span>
              </div>
            </div>
            <div className="md:hidden border-t border-white/10 px-4 pb-3 pt-2">
              <SystemClock />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 pb-5 sm:pb-6 lg:pb-8 pt-4 sm:pt-5">
          <div className="flex h-full flex-col lg:flex-row gap-4 lg:gap-6 xl:gap-8">
            <div className="flex w-full lg:w-[38%] xl:w-[36%] flex-col gap-4 lg:gap-5">
              <GlassPanel title="CONTROL SURFACE" subtitle="MISSION CONTROL PANELS">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-[0.6rem] text-slate-400 tracking-[0.22em] uppercase">
                        Orders
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {totalOrders}
                      </span>
                      <span className="text-[0.65rem] text-slate-400">
                        {activeOrders} active · {completedOrders} completed
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-[0.6rem] text-slate-400 tracking-[0.22em] uppercase">
                        Active Helpers
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {helperSim.activeHelpers.length}
                      </span>
                      <span className="text-[0.65rem] text-slate-400">
                        {helperSim.running
                          ? `${helperSim.activeHelpers.length} active / ${helpers.length} total`
                          : `Paused · ${helperSim.activeHelpers.length} active / ${helpers.length} total`}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-[0.6rem] text-slate-400 tracking-[0.22em] uppercase">
                        Auto Sim
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {autoSim ? "ON" : "OFF"}
                      </span>
                      <span className="text-[0.65rem] text-slate-400">
                        Auto: ~1 new order every minute (random 5% failure)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-400/10 px-3.5 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-emerald-200 uppercase hover:bg-emerald-400/20 transition-colors"
                      onClick={createBatchOrders}
                    >
                      Spawn 5 new orders
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-sky-400/70 bg-sky-400/10 px-3.5 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-sky-200 uppercase hover:bg-sky-400/20 transition-colors"
                      onClick={advanceOrders}
                    >
                      Advance simulation
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-slate-500/80 bg-slate-900/40 px-3 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-slate-300 uppercase hover:bg-slate-800/80 transition-colors"
                      onClick={() => setAutoSim((value) => !value)}
                    >
                      {autoSim ? "Disable auto simulation" : "Enable auto simulation"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-red-400/60 bg-red-500/5 px-3 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-red-300 uppercase hover:bg-red-500/10 transition-colors"
                      onClick={resetOrders}
                    >
                      Reset orders
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-amber-400/70 bg-amber-400/10 px-3.5 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-amber-200 uppercase hover:bg-amber-400/20 transition-colors"
                      onClick={helperSim.toggleRunning}
                    >
                      {helperSim.running ? "Pause helper sim" : "Resume helper sim"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-fuchsia-400/70 bg-fuchsia-500/10 px-3 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-fuchsia-100 uppercase hover:bg-fuchsia-500/20 transition-colors"
                      onClick={() => setStressTestMode((value) => !value)}
                    >
                      {stressTestMode ? "Stress test: ON" : "Stress test: OFF"}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] uppercase transition-colors ${
                        homeMode
                          ? "border border-fuchsia-400/80 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/20"
                          : "border border-cyan-400/70 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                      }`}
                      onClick={() => setHomeMode((value) => !value)}
                    >
                      {homeMode
                        ? "Helper choice: Go home (purple)"
                        : "Helper choice: Take orders (blue)"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-orange-400/70 bg-orange-500/10 px-3 py-1.5 text-[0.7rem] sm:text-xs font-medium tracking-[0.18em] text-orange-100 uppercase hover:bg-orange-500/20 transition-colors"
                      onClick={() => setLaundryFailureMode((value) => !value)}
                    >
                      {laundryFailureMode ? "Laundry Failure: ON" : "Laundry Failure: OFF"}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.22em] uppercase">
                      <span className="order-card-title">Recent Orders</span>
                      <span>{recentOrders.length} items</span>
                    </div>
                    <div className="mt-1 space-y-1.5 leading-[1.4]">
                      {recentOrders.length === 0 ? (
                        <div className="text-slate-500">
                          No simulated orders yet. Spawn a batch to begin.
                        </div>
                      ) : (
                        recentOrders.map((order) => {
                          const house = houseClients.find((item) => item.id === order.houseId);
                          const laundry = laundryLocations.find(
                            (item) => item.id === order.laundryId
                          );
                          const elapsedSeconds = Math.max(
                            0,
                            Math.floor((now - order.createdAt) / 1000)
                          );
                          const minutes = Math.floor(elapsedSeconds / 60);
                          const seconds = elapsedSeconds % 60;
                          const profile = computeOrderEngagementProfile({
                            order,
                            nowMs: now,
                            house,
                            laundry,
                            allOrders: orders,
                          });
                          const engagedMinutes = profile.engagedMinutes;
                          const standardTotalMinutes = profile.targetMinutes;
                          const washStandardMinutes = Math.round(standardTotalMinutes * 0.45);
                          const dryStandardMinutes = standardTotalMinutes - washStandardMinutes;
                          const inefficiencyDetected =
                            !order.machineFailed &&
                            order.status !== "Completed" &&
                            profile.efficiencyRatio > 1.1;
                          const guaranteeAdjustment = computeGuaranteeAdjustment(
                            engagedMinutes,
                            standardTotalMinutes,
                            order.rating
                          );

                          const assetStatus = routingEngineState.assetStatus[order.id];
                          const isRescueStatus =
                            assetStatus === "InRescue" ||
                            assetStatus === "PendingRescue" ||
                            assetStatus === "SearchingForNewHelper";

                          let routeMode: PlanId = "Premium";
                          let routeTagline = "High-Quality Custody Path";
                          if (isRescueStatus) {
                            routeMode = "Flash";
                            routeTagline = "Priority Rescue Ready";
                          } else if (order.homeModeAtCreation) {
                            routeMode = "Eco";
                            routeTagline = "Home-Path Optimized";
                          }
                          const routeLabel = `Routed via: ${routeMode.toUpperCase()} (${routeTagline})`;

                          let helperLabel = "Helper (Unassigned)";
                          let helperIdDisplay = "Helper";
                          let persona = "Expert";
                          if (order.helperId) {
                            const integrity = helperIntegrity[order.helperId];
                            helperIdDisplay = order.helperId.startsWith("helper_")
                              ? order.helperId.replace("helper_", "Helper_")
                              : order.helperId;
                            persona =
                              integrity && integrity.highValueEligible
                                ? "Quality Certified"
                                : "Efficiency Expert";
                            helperLabel = `${helperIdDisplay} (${persona})`;
                          }

                          const ratingLabel =
                            typeof order.rating === "number"
                              ? formatStarRating(order.rating)
                              : null;

                          let helperMeta = helperLabel;
                          if (typeof order.rating === "number") {
                            helperMeta = `${helperMeta} · ${formatStarRating(order.rating)}`;
                          }

                          let displayGuaranteeAdjustment = guaranteeAdjustment;
                          let lowRatingFlag = false;
                          if (typeof order.rating === "number") {
                            const clampedRating = Math.max(
                              1,
                              Math.min(5, Math.round(order.rating))
                            );
                            if (clampedRating < 3) {
                              lowRatingFlag = true;
                              if (displayGuaranteeAdjustment >= 0) {
                                displayGuaranteeAdjustment = -Math.abs(
                                  displayGuaranteeAdjustment
                                );
                              }
                            }
                          }

                          let statusLabel: string;
                          let remainingForSummary: number | null = null;
                          let statusColorClass = "";

                          if (order.status === "Completed") {
                            statusLabel = "Completed";
                          } else if (isRescueStatus) {
                            statusLabel = "EN ROUTE (RESCUE)";
                            statusColorClass = "text-red-300";
                          } else if (engagedMinutes < washStandardMinutes) {
                            const remaining = Math.max(
                              0,
                              washStandardMinutes - engagedMinutes
                            );
                            remainingForSummary = remaining;
                            statusLabel = "WASHING";
                          } else if (engagedMinutes < standardTotalMinutes) {
                            const remaining = Math.max(
                              0,
                              standardTotalMinutes - engagedMinutes
                            );
                            remainingForSummary = remaining;
                            statusLabel = "DRYING";
                          } else if (engagedMinutes < standardTotalMinutes + 10) {
                            statusLabel = "FOLDING · Helper processing laundry";
                          } else {
                            statusLabel = "DELIVERING";
                          }

                          if (remainingForSummary != null) {
                            statusLabel = `${statusLabel} · ${remainingForSummary}m`;
                          }

                          if (ratingLabel) {
                            statusLabel = `${statusLabel} · ${ratingLabel}`;
                          }

                          const helperRouteSummary = `${persona.includes("Quality") ? "Quality" : "Expert"}: ${helperIdDisplay} | Route: ${routeMode.toUpperCase()} (${routeTagline})`;

                          const isInteractive = order.status !== "Completed";

                          return (
                            <div
                              key={order.id}
                              className={`flex items-center justify-between gap-2 text-slate-200/90 ${
                                isInteractive
                                  ? "cursor-pointer hover:bg-white/5 rounded-xl px-1 py-1"
                                  : ""
                              }`}
                              onClick={() => {
                                if (isInteractive) {
                                  setMediaModalOrderId(order.id);
                                }
                              }}
                            >
                              <div className="flex flex-col leading-[1.4]">
                                <span
                                  className={`order-card-title tracking-[0.18em] uppercase ${statusColorClass} ${
                                    inefficiencyDetected && !isRescueStatus
                                      ? "text-amber-300"
                                      : ""
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                                <span className="order-card-meta text-slate-400 order-card-ellipsis">
                                  {house ? house.id : "Customer"} →{" "}
                                  {laundry ? laundry.name : "Laundry"} · {routeLabel}
                                </span>
                                <span className="order-card-meta text-slate-400 order-card-ellipsis">
                                  {helperRouteSummary}
                                </span>
                                <span
                                  className={`order-card-meta ${
                                    displayGuaranteeAdjustment < 0 || lowRatingFlag
                                      ? "text-rose-300"
                                      : "text-slate-400"
                                  }`}
                                >
                                  Prop 22 Adjustment ≈{" "}
                                  <span className="order-card-number">
                                    {displayGuaranteeAdjustment}
                                  </span>
                                </span>
                              </div>
                              <span className="order-card-number text-slate-400">
                                {minutes.toString().padStart(2, "0")}:
                                {seconds.toString().padStart(2, "0")}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-3 border-t border-white/10 pt-2.5">
                      <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.22em] uppercase">
                        <span className="order-card-title">Completed Orders</span>
                        <span>{completedOrders} total</span>
                      </div>
                      <div className="mt-1.5 space-y-1.5 leading-[1.4]">
                        {completedRecentOrders.length === 0 ? (
                          <div className="text-slate-500">No completed orders yet.</div>
                        ) : (
                          completedRecentOrders.map((order) => {
                            const house = houseClients.find((item) => item.id === order.houseId);
                            const laundry = laundryLocations.find(
                              (item) => item.id === order.laundryId
                            );
                           const sopItems =
                            typeof order.rating === "number" && order.rating < 3
                              ? helperSopChecklist[order.helperId ?? ""] ??
                                helperSopChecklist.default
                              : null;

                            return (
                              <div
                                key={order.id}
                                className="flex items-center justify-between gap-2 text-slate-200/90"
                              >
                                <div className="flex flex-col leading-[1.4]">
                                  <span className="order-card-title tracking-[0.18em] uppercase">
                                    Completed
                                  </span>
                                  <span className="order-card-meta text-slate-400 order-card-ellipsis">
                                    {house ? house.id : "Customer"} →{" "}
                                    {laundry ? laundry.name : "Laundry"}
                                    {order.homeModeAtCreation ? " · HOME" : ""}
                                    {order.secondCycleUnlocked ? " · 2nd cycle" : ""}
                                    {typeof order.rating === "number"
                                      ? ` · ${formatStarRating(order.rating)}`
                                      : ""}
                                    {order.ratingReason ? ` · ${order.ratingReason}` : ""}
                                  </span>
                                  {sopItems ? (
                                    <span className="mt-0.5 order-card-meta text-amber-300">
                                      SOP checkpoints: {sopItems.join(" · ")}
                                    </span>
                                  ) : null}
                                  <span className="mt-0.5 order-card-meta text-slate-400 order-card-ellipsis">
                                    Next: {homeMode ? "Go Home" : "Stay at Node"} (Stay at Node / Go
                                    Home)
                                  </span>
                                </div>
                                <span className="order-card-number text-slate-400">
                                  {new Date(order.createdAt).toLocaleTimeString("en-US", {
                                    hour12: false,
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.22em] uppercase">
                        <span>Asset Protection</span>
                        <span>
                          {latestAssetStatus
                            ? latestTrunkUnlocked && latestAssetStatus !== "Transferred"
                                ? "Transferring Assets"
                                : latestAssetStatus
                              : latestRoutingAssignments.length > 0
                              ? "Pending"
                              : "Idle"}
                        </span>
                      </div>
                      {serviceException === "laundry_failure" ? (
                        <div className="mt-1 flex flex-col gap-0.5 text-[0.65rem]">
                          <span className="text-rose-300">Service Cancelled - Refund Triggered</span>
                          <span className="text-sky-300">
                            SOP: Waterproof Bagging & Return Service Fee Waived
                          </span>
                        </div>
                      ) : null}
                      {mechanicalOverrideEnabled ? (
                          <div className="mt-1 flex items-center justify-between text-[0.65rem] text-emerald-300">
                            <span>Mechanical Override</span>
                            <span>ENABLED</span>
                          </div>
                        ) : null}
                        {latestAssetOrderId &&
                        latestAssetStatus === "InRescue" &&
                        latestRescueEtaLabel ? (
                          <div className="mt-1 flex items-center justify-between text-[0.65rem] text-slate-300">
                            <span>Order {latestAssetOrderId}</span>
                            <span>
                              Helper {latestRescueAssignment?.helperId ?? "-"} · ETA{" "}
                              {latestRescueEtaLabel}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-1 max-h-24 overflow-y-auto space-y-1.5 text-[0.7rem] sm:text-xs">
                          {latestRoutingAssignments.length === 0 ? (
                            <div className="text-slate-500">
                              Enable stress test to simulate chain collisions.
                            </div>
                          ) : (
                            latestRoutingAssignments.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex flex-col">
                                  <span className="text-[0.65rem] text-slate-300">
                                    {entry.orderId} · Attempt {entry.attempt}
                                  </span>
                                  <span className="text-[0.6rem] text-slate-400">
                                    Helper {entry.helperId} · {entry.status}
                                  </span>
                                </div>
                                <span className="text-[0.6rem] text-slate-500">
                                  {entry.vehicleId}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.22em] uppercase">
                        <span>Helper Status</span>
                        <span>
                          {helperSim.activeHelpers.length} / {helpers.length} active
                        </span>
                      </div>
                      <div className="mt-1 max-h-32 overflow-y-auto space-y-1.5 text-[0.7rem] sm:text-xs">
                        {helperSim.helpers.map((entry) => {
                          let statusLabel = "Off Duty";
                          let statusClassName =
                            "text-[0.6rem] text-slate-400 tracking-[0.12em] uppercase";
                          let dotClassName = "h-1.5 w-1.5 rounded-full bg-slate-500";
                          const integrity = helperIntegrity[entry.id];
                          const integrityLabel =
                            integrity && typeof integrity.score === "number"
                              ? `${integrity.score} pts`
                              : "-";
                          const highValueLabel =
                            integrity && integrity.highValueEligible ? "HV" : "No HV";
                          if (entry.active && entry.status === "available") {
                            statusLabel = homeMode
                              ? "Returning Home"
                              : "In Transit (Autonomous)";
                            statusClassName =
                              "text-[0.6rem] text-emerald-200 tracking-[0.12em] uppercase";
                            dotClassName =
                              "h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]";
                          } else if (entry.active && entry.status === "unavailable") {
                            const index =
                              Math.abs(
                                entry.id.charCodeAt(0) + entry.id.length * 7
                              ) % laundryLocations.length;
                            const laundryName =
                              laundryLocations[index]?.name ?? "E-Z Wash";
                            statusLabel = `Folding @ ${laundryName}`;
                            statusClassName =
                              "text-[0.6rem] text-amber-200 tracking-[0.12em] uppercase";
                            dotClassName =
                              "h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]";
                          }
                          const trustSeed =
                            entry.id.charCodeAt(entry.id.length - 1) +
                            entry.id.length * 13;
                          const trustScore = 85 + (Math.abs(trustSeed) % 16);
                          const activeMinutesEstimate = entry.active
                            ? 30 +
                              (Math.floor(now / 60000) +
                                entry.id.charCodeAt(0) * 3) %
                                210
                            : 5 +
                              (Math.floor(now / 60000) +
                                entry.id.charCodeAt(0) * 5) %
                                25;
                          const hourlyRateUsd =
                            18 + (entry.id.charCodeAt(0) % 7);
                          const earningsUsd =
                            (activeMinutesEstimate / 60) * hourlyRateUsd;
                          const earningsLabel = `$${earningsUsd.toFixed(2)}`;
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className={dotClassName} />
                                <span className="text-[0.65rem] text-slate-300">
                                  {entry.id}
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={statusClassName}>{statusLabel}</span>
                                <span className="text-[0.6rem] text-slate-400">
                                  Trust {trustScore} · Today {earningsLabel} ·{" "}
                                  {integrityLabel} · {highValueLabel}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] text-slate-400 tracking-[0.22em] uppercase">
                        <span>Helper Events</span>
                        <span>{helperSim.logs.length} events</span>
                      </div>
                      <div className="mt-1 max-h-32 overflow-y-auto space-y-1.5 text-[0.7rem] sm:text-xs">
                        {helperSim.logs.length === 0 ? (
                          <div className="text-slate-500">No recent events.</div>
                        ) : (
                          helperSim.logs.slice(0, 8).map((entry) => {
                            let label = "Status changed";
                            if (entry.type === "added") {
                              label = `${entry.helperId} uploaded 10-piece capture`;
                            } else if (entry.type === "removed") {
                              label = `${entry.helperId} returning home (Route closed)`;
                            } else if (entry.type === "statusChanged") {
                              if (entry.from && entry.to) {
                                if (entry.from === "available" && entry.to === "unavailable") {
                                  label = `${entry.helperId} folding SOP @ E-Z Wash`;
                                } else if (
                                  entry.from === "unavailable" &&
                                  entry.to === "available"
                                ) {
                                  label = "Mechanical Override Engaged (Vehicle_02)";
                                } else {
                                  label = `${entry.from} → ${entry.to}`;
                                }
                              }
                            }
                            return (
                              <div
                                key={entry.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <div className="flex flex-col">
                                  <span className="text-[0.65rem] text-slate-300">
                                    {entry.helperId}
                                  </span>
                                  <span className="text-[0.6rem] text-slate-400">
                                    {label}
                                  </span>
                                </div>
                                <span className="text-[0.6rem] text-slate-500">
                                  {new Date(entry.timestamp).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour12: false,
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                    }
                                  )}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </GlassPanel>

              <GlassPanel
                title="SYLPHOLD ORDER DECISION CENTER"
                subtitle="ROUTING STRATEGY ENGINE"
              >
                <div className="space-y-3 sm:space-y-4 text-[0.7rem] sm:text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.9)]" />
                      <span className="tracking-[0.18em] uppercase text-slate-200">
                        Decision State
                      </span>
                    </div>
                    <span className="text-slate-300">
                      {decisionStateLabel}
                    </span>
                  </div>

                  {decisionPhase === "idle" ? (
                    <div className="space-y-3">
                      <p className="text-slate-400">
                        Generate a synthetic order and let Sylphold compute candidate routes
                        between households, helpers, and laundries.
                      </p>
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/70 bg-emerald-400/20 px-4 py-2.5 text-[0.75rem] sm:text-sm font-semibold tracking-[0.22em] text-emerald-50 uppercase hover:bg-emerald-400/30 hover:border-emerald-300 transition-colors"
                        onClick={handleGenerateSimulationOrder}
                      >
                        Generate Simulation Order
                      </button>
                      <div className="grid grid-cols-2 gap-2 text-[0.65rem] text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Active Orders
                          </span>
                          <span className="text-slate-200">
                            {activeOrders} / {totalOrders} in flight
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Completed
                          </span>
                          <span className="text-slate-200">{completedOrders} settled</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {decisionPhase === "running" ? (
                    <div className="space-y-3">
                      <p className="text-slate-400">
                        Current simulation is processing this order. Waiting for delivery to
                        complete.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[0.65rem] text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Active Orders
                          </span>
                          <span className="text-slate-200">
                            {activeOrders} / {totalOrders} in flight
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Completed
                          </span>
                          <span className="text-slate-200">{completedOrders} settled</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {decisionPhase === "completed" ? (
                    <div className="space-y-3">
                      <p className="text-slate-400">
                        Delivery completed. You can generate another simulation order to explore
                        a new route.
                      </p>
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/70 bg-emerald-400/20 px-4 py-2.5 text-[0.75rem] sm:text-sm font-semibold tracking-[0.22em] text-emerald-50 uppercase hover:bg-emerald-400/30 hover:border-emerald-300 transition-colors"
                        onClick={handleGenerateSimulationOrder}
                      >
                        Generate Simulation Order
                      </button>
                      <div className="grid grid-cols-2 gap-2 text-[0.65rem] text-slate-400">
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Active Orders
                          </span>
                          <span className="text-slate-200">
                            {activeOrders} / {totalOrders} in flight
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="tracking-[0.2em] uppercase text-slate-300">
                            Completed
                          </span>
                          <span className="text-slate-200">{completedOrders} settled</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {decisionPhase === "loading" ? (
                    <div className="space-y-3">
                      <p className="text-slate-400">AI Pathfinding...</p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="ai-progress-bar" />
                      </div>
                      <p className="text-[0.65rem] text-slate-500">
                        Evaluating travel time, helper coverage, and SLA constraints.
                      </p>
                    </div>
                  ) : null}

                  {decisionPhase === "options" ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <button
                          type="button"
                          className="flex flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-left hover:border-emerald-300/80 hover:bg-emerald-400/10 transition-colors"
                          onClick={() => startSimulation("Flash")}
                        >
                          <span className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-emerald-200">
                            Flash
                          </span>
                          <span className="text-[0.75rem] text-slate-100">
                            {flashMetrics
                              ? `${Math.round(flashMetrics.estimatedMinutes)} min | ${flashMetrics.totalDistanceKm.toFixed(
                                  1
                                )} km`
                              : "Computing..."}
                          </span>
                          <span className="text-[0.65rem] text-slate-400">
                            {flashMetrics
                              ? `Eff ${Math.round(flashMetrics.efficiency * 100)}% · Priority route`
                              : "Latency-first routing for urgent orders."}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="flex flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-left hover:border-sky-300/80 hover:bg-sky-400/10 transition-colors"
                          onClick={() => startSimulation("Eco")}
                        >
                          <span className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-sky-200">
                            Eco
                          </span>
                          <span className="text-[0.75rem] text-slate-100">
                            {ecoMetrics
                              ? `${Math.round(ecoMetrics.estimatedMinutes)} min | ${ecoMetrics.totalDistanceKm.toFixed(
                                  1
                                )} km`
                              : "Computing..."}
                          </span>
                          <span className="text-[0.65rem] text-slate-400">
                            {ecoMetrics
                              ? lowestGuaranteePlanId === "Eco"
                                ? `GA ${Math.round(
                                    ecoMetrics.guaranteeAdjustment * 100
                                  )} (lowest) · Eff ${Math.round(
                                    ecoMetrics.efficiency * 100
                                  )}%`
                                : `GA ${Math.round(
                                    ecoMetrics.guaranteeAdjustment * 100
                                  )} · Eff ${Math.round(
                                    ecoMetrics.efficiency * 100
                                  )}%`
                              : "Optimizing detour and subsidy savings."}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="flex flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-left hover:border-amber-300/80 hover:bg-amber-400/10 transition-colors"
                          onClick={() => startSimulation("Premium")}
                        >
                          <span className="text-[0.7rem] font-semibold tracking-[0.22em] uppercase text-amber-200">
                            Premium
                          </span>
                          <span className="text-[0.75rem] text-slate-100">
                            {premiumMetrics
                              ? `${Math.round(
                                  premiumMetrics.estimatedMinutes
                                )} min | ${premiumMetrics.totalDistanceKm.toFixed(1)} km`
                              : "Computing..."}
                          </span>
                          <span className="text-[0.65rem] text-slate-400">
                            {premiumMetrics
                              ? premiumTrustScore !== null
                                ? `Cust ${Math.round(
                                    premiumMetrics.chainOfCustodyScore * 100
                                  )} · Trust ${premiumTrustScore} · Eff ${Math.round(
                                    premiumMetrics.efficiency * 100
                                  )}%`
                                : `Cust ${Math.round(
                                    premiumMetrics.chainOfCustodyScore * 100
                                  )} · Eff ${Math.round(premiumMetrics.efficiency * 100)}%`
                              : "Evaluating distance, custody, and trust."}
                          </span>
                        </button>
                      </div>
                      {planMetrics && planMetrics.length > 0 ? (
                        <div className="rounded-2xl border border-sky-400/40 bg-slate-900/40 px-3.5 py-3 space-y-2">
                          <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] tracking-[0.22em] uppercase text-slate-300">
                            <span>Plan Comparison · Chain of Custody / Fault Recovery first</span>
                            <span className="text-sky-300">
                              {bestPlan ? `Best by score: ${bestPlan.label}` : "Scoring plans"}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-[0.65rem] text-slate-200">
                            {planMetrics.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="tracking-[0.18em] uppercase w-20 shrink-0">
                                  {item.label}
                                </span>
                                <span className="flex-1">
                                  Cust {Math.round(item.chainOfCustodyScore * 100)}
                                  {item.id === "Premium" && premiumTrustScore !== null
                                    ? ` · Trust ${premiumTrustScore}`
                                    : null}{" "}
                                  · Fault {Math.round(item.faultRecoveryScore * 100)} · GA{" "}
                                  {Math.round(item.guaranteeAdjustment * 100)} ·{" "}
                                  {Math.round(item.estimatedMinutes)} min ·{" "}
                                  {item.totalDistanceKm.toFixed(1)} km
                                </span>
                                <span className="w-32 text-right text-slate-400">
                                  Score {Math.round(item.compositeScore * 100)} · Eff{" "}
                                  {Math.round(item.efficiency * 100)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] tracking-[0.22em] uppercase text-slate-300">
                      <span>Route Context</span>
                      <span className="text-slate-400">
                        {selectedPlan ? `Plan: ${selectedPlan}` : "No plan locked"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[0.65rem] text-slate-200">
                      <div className="flex flex-col gap-1">
                        <span className="tracking-[0.18em] uppercase text-slate-300">Origin</span>
                        <div className="flex items-center gap-2">
                          <div className="laundry-marker-dot" />
                          <span className="truncate">
                            {laundryLocations[0] ? laundryLocations[0].name : "Laundry hub"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[0.6rem] text-slate-400">
                          <div className="vehicle-marker-dot" />
                          <span className="truncate">
                            {vehicles[0] ? vehicles[0].id : "Vehicle A"}
                            {vehicles[1] ? ` · ${vehicles[1].id}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="tracking-[0.18em] uppercase text-slate-300">
                          Destination
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="house-marker-dot" />
                          <span className="truncate">
                            {houseClients[0] ? houseClients[0].id : "Client household"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[0.6rem] text-slate-400">
                          <div className="helper-marker-dot" />
                          <span className="truncate">
                            {helpers[0] ? helpers[0].id : "Helper node"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {planHistory.length > 0 ? (
                      <div className="mt-2 border-t border-white/10 pt-2 space-y-1.5 text-[0.65rem] text-slate-200">
                        <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] tracking-[0.22em] uppercase text-slate-300">
                          <span>Recent Decisions</span>
                          <span className="text-slate-400">{planHistory.length} runs</span>
                        </div>
                        {planHistory.slice(0, 4).map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="tracking-[0.18em] uppercase">{entry.plan}</span>
                            <span className="text-[0.6rem] text-slate-400">
                              {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                                hour12: false,
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            <span className="text-[0.6rem] text-slate-300">
                              Score {Math.round(entry.compositeScore * 100)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </GlassPanel>
            </div>

            <div className="flex w-full flex-1 items-stretch">
              <div className="relative w-full h-[260px] sm:h-[320px] md:h-[380px] lg:h-full">
                <MapPlaceholder
                  lockedPlanLabel={selectedPlan ? `${selectedPlan} route locked` : null}
                  onSimulationReady={(value) => {
                    simulationContextRef.current = value;
                  }}
                />
                {followDebug ? (
                  <div className="pointer-events-none absolute left-3 top-3 rounded-2xl border border-emerald-400/40 bg-slate-900/85 px-3 py-2 text-[0.6rem] text-slate-100 shadow-[0_16px_40px_rgba(15,23,42,0.95)] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tracking-[0.22em] uppercase text-slate-300">
                        Follow Debug
                      </span>
                      <span className="text-[0.55rem] text-emerald-300 tracking-[0.18em] uppercase">
                        Mode: buffered
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[0.55rem] text-slate-300">
                      <span>Car {followDebug.carId}</span>
                      <span>
                        {followDebug.phase} · {followDebug.lat.toFixed(4)},{' '}
                        {followDebug.lng.toFixed(4)}
                      </span>
                    </div>
                    <div className="text-[0.55rem] text-slate-300">
                      <span className="text-slate-400">Out of view: </span>
                      {followDebug.outOfView.length === 0
                        ? "None"
                        : followDebug.outOfView.join(", ")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </main>
        {mediaModalOrder ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
            <div className="w-full max-w-3xl rounded-3xl border border-white/15 bg-slate-900/95 shadow-2xl px-4 sm:px-6 py-4 sm:py-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[0.7rem] sm:text-xs tracking-[0.22em] uppercase text-slate-400">
                    Media Chain Monitor
                  </span>
                  <span className="text-sm sm:text-base font-semibold text-slate-100">
                    Order {mediaModalOrder.id}
                  </span>
                  <span className="text-[0.65rem] text-slate-400 mt-1">
                    Helper {mediaModalOrder.helperId ?? "-"} · Status{" "}
                    {mediaModalOrder.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full border border-slate-500/70 bg-slate-800/70 px-3 py-1.5 text-[0.7rem] sm:text-xs tracking-[0.18em] uppercase text-slate-200 hover:bg-slate-700/80 transition-colors"
                  onClick={() => setMediaModalOrderId(null)}
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-[0.7rem] sm:text-xs">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="tracking-[0.2em] uppercase text-slate-300">
                      10-piece capture
                    </span>
                    <span className="text-[0.6rem] text-slate-400">
                      {(mediaModalOrder.media?.bundleShots.length ?? 0) || 0} frames
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(mediaModalOrder.media?.bundleShots ?? []).map((src) => (
                      <div
                        key={src}
                        className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-800/80"
                      >
                        <img
                          src={src}
                          alt="Bundle shot"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                    {(mediaModalOrder.media?.bundleShots ?? []).length === 0 ? (
                      <div className="col-span-2 flex items-center justify-center rounded-xl border border-dashed border-slate-600/80 bg-slate-900/60 px-3 py-6 text-[0.65rem] text-slate-400">
                        10-piece capture not yet uploaded
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="tracking-[0.2em] uppercase text-slate-300">
                      In-store wash/dry operations
                    </span>
                    <span className="text-[0.6rem] text-slate-400">
                      {(mediaModalOrder.media?.machineShots.length ?? 0) || 0} frames
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(mediaModalOrder.media?.machineShots ?? []).map((src) => (
                      <div
                        key={src}
                        className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-800/80"
                      >
                        <img
                          src={src}
                          alt="Machine shot"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                    {(mediaModalOrder.media?.machineShots ?? []).length === 0 ? (
                      <div className="col-span-2 flex items-center justify-center rounded-xl border border-dashed border-slate-600/80 bg-slate-900/60 px-3 py-6 text-[0.65rem] text-slate-400">
                        In-store operations photos not yet uploaded
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;
