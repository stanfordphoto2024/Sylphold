import { useEffect, useState, useRef, type ReactNode } from "react";
import mapboxgl from "mapbox-gl";
import { MapPlaceholder } from "./components/MapPlaceholder";
import { MapLegend } from "./components/MapLegend";
import { SystemClock, Logo, GlassPanel } from "./components/LayoutComponents";
import { useHelperSimulation } from "./hooks/useHelperSimulation";
import {
  laundryLocations,
  houseClients,
  helpers,
  vehicles,
  helperHomeTargets,
  createMockOrderMedia,
  helperSopChecklist,
  type Order,
  type OrderMedia,
  type OrderStatus,
  type LaundryLocation,
  type HouseClient,
  type Helper,
  type Vehicle,
  type TelemetrySnapshot,
  type FollowMode,
  type PlanId,
  type PlanMetrics,
  type LockStatus,
  type LockUnlockLog,
  type WeightConfig,
  type PlanHistoryEntry,
  type FlashHelperStats,
  type PremiumHelperStats,
  type HelperStatus,
  type HelperSimEntry,
  type HelperSimConfig,
  type HelperSimLogEntry,
  type HelperSimApi,
  type HelperIntegrity,
  type AssetTransferStatus,
  type DispatchAssignmentStatus,
  type DispatchAssignment,
  type RoutingEngineState,
  type CollisionEvent,
  type Prop22EvaluationStatus,
  type Prop22Evaluation,
} from "./utils/constants";
import {
  createTopDownVehicleSvg,
  createTransferringAssetsSvg,
  createRandomInRange,
  haversineDistanceKm,
  computeLaundryLoad,
  computeHelperLoad,
  formatStarRating,
  type MarkerWithElement,
  fetchRoute,
} from "./utils/helpers";
import {
  isOnRouteHome,
  routeLengthKm,
  computeOrderEngagementProfile,
  computeFlashHelperStats,
  computePremiumHelperStats,
  computeBaseEfficiency,
  evaluateProp22Compliance,
  computeEngagedMinutes,
  computeGuaranteeAdjustment,
  syncHelperMarkersWithSimulation,
  syncVehicleMarkersWithAssetStatus,
  handleCollisionWithRecursiveDispatch,
  markAssetTransferCompleted,
} from "./utils/businessLogic";
import {
  createOrUpdateRouteSource,
  runOrderSimulation,
  createCarMarkerElement,
  createOrUpdateQueuedSpiderLines,
  createOrUpdateRescueSpiderLines,
  startLaundryProcessingAnimation,
  startHouseArrivalAnimation,
  createCountdownMarkerElement,
  createOrUpdateReturnBufferZone,
  clearReturnBufferZone,
  ensureRouteLayer,
  createCameraFollowHandler,
  animateMarkerAlongRoute,
} from "./utils/mapUtils";

let helpersHiddenByOrderSim = false;
let lastMissionCarMarker: mapboxgl.Marker | null = null;














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
    syncHelperMarkersWithSimulation(context, helperSim.helpers, helpersHiddenByOrderSim);
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
      syncHelperMarkersWithSimulation(context, helperSim.helpers, helpersHiddenByOrderSim);
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
          <div className="flex h-full flex-col-reverse lg:flex-row gap-4 lg:gap-6 xl:gap-8">
            <div className="flex w-full lg:w-[38%] xl:w-[36%] flex-col gap-4 lg:gap-5">
              <GlassPanel title="CONTROL SURFACE" subtitle="MISSION CONTROL PANELS">
                <div className="flex flex-col gap-3 sm:gap-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 tracking-[0.22em] uppercase">
                        Orders
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {totalOrders}
                      </span>
                      <span className="text-xs text-slate-400">
                        {activeOrders} active · {completedOrders} completed
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 tracking-[0.22em] uppercase">
                        Active Helpers
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {helperSim.activeHelpers.length}
                      </span>
                      <span className="text-xs text-slate-400">
                        {helperSim.running
                          ? `${helperSim.activeHelpers.length} active / ${helpers.length} total`
                          : `Paused · ${helperSim.activeHelpers.length} active / ${helpers.length} total`}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex flex-col gap-1.5">
                      <span className="text-xs text-slate-400 tracking-[0.22em] uppercase">
                        Auto Sim
                      </span>
                      <span className="text-base sm:text-lg font-semibold text-slate-50">
                        {autoSim ? "ON" : "OFF"}
                      </span>
                      <span className="text-xs text-slate-400">
                        Auto: ~1 new order every minute (random 5% failure)
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-emerald-200 uppercase hover:bg-emerald-400/20 transition-colors"
                      onClick={createBatchOrders}
                    >
                      Spawn 5 new orders
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-sky-400/70 bg-sky-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-sky-200 uppercase hover:bg-sky-400/20 transition-colors"
                      onClick={advanceOrders}
                    >
                      Advance simulation
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-slate-500/80 bg-slate-900/40 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-slate-300 uppercase hover:bg-slate-800/80 transition-colors"
                      onClick={() => setAutoSim((value) => !value)}
                    >
                      {autoSim ? "Disable auto simulation" : "Enable auto simulation"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-red-400/60 bg-red-500/5 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-red-300 uppercase hover:bg-red-500/10 transition-colors"
                      onClick={resetOrders}
                    >
                      Reset orders
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-amber-400/70 bg-amber-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-amber-200 uppercase hover:bg-amber-400/20 transition-colors"
                      onClick={helperSim.toggleRunning}
                    >
                      {helperSim.running ? "Pause helper sim" : "Resume helper sim"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full border border-fuchsia-400/70 bg-fuchsia-500/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-fuchsia-100 uppercase hover:bg-fuchsia-500/20 transition-colors"
                      onClick={() => setStressTestMode((value) => !value)}
                    >
                      {stressTestMode ? "Stress test: ON" : "Stress test: OFF"}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-xs font-medium tracking-[0.18em] uppercase transition-colors ${
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
                      className="inline-flex items-center justify-center rounded-full border border-orange-400/70 bg-orange-500/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-orange-100 uppercase hover:bg-orange-500/20 transition-colors"
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
                      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
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
                <div className="space-y-3 sm:space-y-4 text-xs">
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
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
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
              <div className="relative w-full h-[45vh] sm:h-[50vh] lg:h-full">
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
