import mapboxgl from "mapbox-gl";
import {
  haversineDistanceKm,
  createTopDownVehicleSvg,
  createTransferringAssetsSvg,
  computeLaundryLoad,
  type MarkerWithElement,
} from "./helpers";
import {
  laundryLocations,
  houseClients,
  helpers,
  vehicles,
  Order,
  Helper,
  HelperSimEntry,
  HelperStatus,
  HelperIntegrity,
  AssetTransferStatus,
  DispatchAssignment,
  DispatchAssignmentStatus,
  RoutingEngineState,
  CollisionEvent,
  Prop22Evaluation,
  Prop22EvaluationStatus,
  PlanId,
  PlanHistoryEntry,
  FlashHelperStats,
  PremiumHelperStats,
  TelemetrySnapshot,
  FollowMode,
} from "./constants";

export function isOnRouteHome(
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

export function routeLengthKm(coords: [number, number][]) {
  let total = 0;
  for (let index = 1; index < coords.length; index += 1) {
    total += haversineDistanceKm(coords[index - 1], coords[index]);
  }
  return total;
}

export function computeOrderEngagementProfile(params: {
  order: Order;
  nowMs: number;
  house?: { coordinates: [number, number] };
  laundry?: { coordinates: [number, number] };
  allOrders: Order[];
}) {
  const { order, nowMs, house, laundry, allOrders } = params;
  const distanceKm =
    house && laundry
      ? haversineDistanceKm(house.coordinates, laundry.coordinates)
      : 3.5;
  const load = computeLaundryLoad(order.laundryId, allOrders);
  const baseMinutes = 36 + distanceKm * 4;
  const loadPenalty = (load - 0.35) * 40;
  let targetMinutes = Math.round(baseMinutes + loadPenalty);
  targetMinutes = Math.max(36, Math.min(90, targetMinutes));
  const rawLinear =
    targetMinutes <= 0
      ? 0
      : Math.max(
          0,
          Math.min(1.3, (nowMs - order.createdAt) / (targetMinutes * 60000))
        );
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
    targetMinutes <= 0
      ? 1
      : Math.max(0, Math.min(2, engagedMinutes / targetMinutes));
  return { engagedMinutes, targetMinutes, efficiencyRatio };
}

export function computeFlashHelperStats(
  helpersList: Helper[],
  currentOrders: Order[],
  nowMs: number,
  routingState: RoutingEngineState,
  integrityMap: Record<string, HelperIntegrity>
): FlashHelperStats[] {
  const result: FlashHelperStats[] = [];
  helpersList.forEach((helper) => {
    const helperOrders = currentOrders.filter(
      (order) => order.helperId === helper.id
    );
    let totalEngaged = 0;
    let totalTarget = 0;
    let count = 0;
    helperOrders.forEach((order) => {
      const house = houseClients.find((item) => item.id === order.houseId);
      const laundry = laundryLocations.find(
        (item) => item.id === order.laundryId
      );
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

export function computePremiumHelperStats(
  helpersList: Helper[],
  currentOrders: Order[],
  integrityMap: Record<string, HelperIntegrity>
): PremiumHelperStats[] {
  const completed = currentOrders.filter(
    (order) => order.status === "Completed"
  );
  const result: PremiumHelperStats[] = [];
  helpersList.forEach((helper) => {
    const helperOrders = completed.filter(
      (order) => order.helperId === helper.id
    );
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

export function computeBaseEfficiency(plan: PlanId, history: PlanHistoryEntry[]) {
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

export function evaluateProp22Compliance(params: {
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

export function computeEngagedMinutes(order: Order, nowMs: number) {
  const engagedMs = Math.max(0, nowMs - order.createdAt);
  return Math.floor(engagedMs / 60000);
}

export function computeGuaranteeAdjustment(
  engagedMinutes: number,
  targetMinutes: number,
  rating?: number
) {
  const minWagePerHour = 16;
  const guaranteeMultiplier = 1.2;
  const revenue = (targetMinutes / 60) * minWagePerHour;
  const guaranteePayout =
    (engagedMinutes / 60) * (minWagePerHour * guaranteeMultiplier);
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

export function syncHelperMarkersWithSimulation(
  context: { helperMarkers: MarkerWithElement[] },
  helperStates: HelperSimEntry[],
  helpersHiddenByOrderSim: boolean
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

export function syncVehicleMarkersWithAssetStatus(
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

export function handleCollisionWithRecursiveDispatch(
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
    nextState.searchRadiusKm[event.orderId] = Math.min(
      currentRadius * 1.5,
      25
    );
    nextState.rescueBonusMultiplier[event.orderId] = Math.min(
      currentBonus + 0.5,
      5
    );
  }

  nextState.assetStatus[event.orderId] = nextStatus;

  const usedHelpers = currentAssignments.map((entry) => entry.helperId);

  const activeHelpers = options.availableHelpers.filter(
    (entry) => entry.active
  );
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
      const candidates = vehicles.filter(
        (vehicle) => vehicle.id !== event.vehicleId
      );
      if (candidates.length > 0) {
        let best = candidates[0];
        let bestDistance = haversineDistanceKm(
          best.coordinates,
          helper.coordinates
        );
        for (let index = 1; index < candidates.length; index += 1) {
          const candidate = candidates[index];
          const distance = haversineDistanceKm(
            candidate.coordinates,
            helper.coordinates
          );
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
    const etaSeconds = Math.max(
      5,
      Math.round((distanceKm / speedKmh) * 3600)
    );
    nextState.rescueEtaSeconds[event.orderId] = etaSeconds;
    const distanceM = distanceKm * 1000;
    if (distanceM < 10) {
      nextState.trunkUnlocked[event.orderId] = true;
    }
  }

  return nextState;
}

export function markAssetTransferCompleted(
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
