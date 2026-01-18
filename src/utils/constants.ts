export type LaundryLocation = {
  id: string;
  name: string;
  coordinates: [number, number];
  type: "Dusty Mauve";
  tags: string[];
  status: string;
};

export type HouseClient = {
  id: string;
  coordinates: [number, number];
};

export type Helper = {
  id: string;
  coordinates: [number, number];
};

export type Vehicle = {
  id: string;
  coordinates: [number, number];
};

export type OrderStatus = "Queued" | "PickingUp" | "Processing" | "Delivering" | "Completed";

export type OrderMedia = {
  bundleShots: string[];
  machineShots: string[];
};

export type Order = {
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

export const laundryLocations: LaundryLocation[] = [
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

export const houseClients: HouseClient[] = [
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
    coordinates: [-122.097, 37.3839],
  },
  {
    id: "house_05",
    coordinates: [-122.0863, 37.3787],
  },
];

export const helpers: Helper[] = [
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

export const helperHomeTargets: Record<string, [number, number]> = {};

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

export const vehicles: Vehicle[] = [
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

export const bundlePlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
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

export const machinePlaceholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
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

export const bundlePlaceholderUrl = `data:image/svg+xml,${encodeURIComponent(bundlePlaceholderSvg)}`;
export const machinePlaceholderUrl = `data:image/svg+xml,${encodeURIComponent(machinePlaceholderSvg)}`;

export function createMockOrderMedia(): OrderMedia {
  const bundleShots = [bundlePlaceholderUrl, bundlePlaceholderUrl, bundlePlaceholderUrl, bundlePlaceholderUrl];
  const machineShots = [machinePlaceholderUrl, machinePlaceholderUrl];
  return { bundleShots, machineShots };
}

export const helperSopChecklist: Record<string, string[]> = {
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

export type PlanId = "Flash" | "Eco" | "Premium";

export type PlanMetrics = {
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

export type LockStatus = "idle" | "locked" | "preparing" | "ready" | "unlocked" | "error";

export type LockUnlockLog = {
  id: string;
  timestamp: number;
  method: "code" | "biometric";
  success: boolean;
  note?: string;
};

export type WeightConfig = {
  distance: number;
  load: number;
  efficiency: number;
};

export type PlanHistoryEntry = {
  id: string;
  plan: PlanId;
  timestamp: number;
  compositeScore: number;
  totalDistanceKm: number;
  estimatedMinutes: number;
};

export type FlashHelperStats = {
  helper: Helper;
  foldingScore: number;
  rescueScore: number;
  combinedScore: number;
  avgEngagedMinutes: number;
  avgTargetMinutes: number;
  avgRescueEtaSeconds: number;
};

export type PremiumHelperStats = {
  helper: Helper;
  neatnessScore: number;
  integrityScore: number;
  qualityScore: number;
  strikes: number;
};

export type HelperStatus = "available" | "unavailable";

export type HelperSimEntry = {
  id: string;
  status: HelperStatus;
  active: boolean;
};

export type HelperSimConfig = {
  initialActive: number;
  minActive: number;
  maxActive: number;
  adjustIntervalMinMs: number;
  adjustIntervalMaxMs: number;
  statusToggleMinMs: number;
  statusToggleMaxMs: number;
};

export type HelperSimLogEntry = {
  id: string;
  helperId: string;
  timestamp: number;
  type: "added" | "removed" | "statusChanged";
  from?: HelperStatus;
  to?: HelperStatus;
};

export type HelperSimApi = {
  helpers: HelperSimEntry[];
  activeHelpers: HelperSimEntry[];
  running: boolean;
  toggleRunning: () => void;
  logs: HelperSimLogEntry[];
};

export type HelperIntegrity = {
  score: number;
  strikes: number;
  highValueEligible: boolean;
};

export type AssetTransferStatus =
  | "Pending"
  | "InRescue"
  | "Transferred"
  | "PendingRescue"
  | "SearchingForNewHelper";

export type DispatchAssignmentStatus = "EnRoute" | "AtScene" | "Completed";

export type DispatchAssignment = {
  id: string;
  orderId: string;
  helperId: string;
  vehicleId: string;
  attempt: number;
  status: DispatchAssignmentStatus;
};

export type RoutingEngineState = {
  assignments: DispatchAssignment[];
  assetStatus: Record<string, AssetTransferStatus>;
  rescueEtaSeconds: Record<string, number>;
  searchRadiusKm: Record<string, number>;
  rescueBonusMultiplier: Record<string, number>;
  trunkUnlocked: Record<string, boolean>;
};

export type CollisionEvent = {
  id: string;
  orderId: string;
  vehicleId: string;
  timestamp: number;
  location: [number, number];
};

export type Prop22EvaluationStatus = "Normal" | "Exception Pending";

export type Prop22Evaluation = {
  orderId: string;
  engagedMinutes: number;
  washStandardMinutes: number;
  dryStandardMinutes: number;
  status: Prop22EvaluationStatus;
};

export type TelemetrySnapshot = {
  carId: string;
  lat: number;
  lng: number;
  speedKmh: number;
  phase: "Inbound" | "Processing" | "Outbound" | "Completed";
  heading?: number;
  battery?: number;
  status?: string;
};

export type FollowMode = "strict" | "buffered" | "region";
