import { type ReactNode } from "react";
import { formatStarRating } from "../utils/helpers";
import {
  computeOrderEngagementProfile,
  computeGuaranteeAdjustment,
} from "../utils/businessLogic";
import {
  type Order,
  type HelperSimApi,
  type HelperIntegrity,
  type Helper,
  type LaundryLocation,
  type HouseClient,
  type PlanId,
  type RoutingEngineState,
} from "../utils/constants";
import { helperSopChecklist } from "../utils/constants";
import React from "react";

// Memoized Dashboard Stats Panel
export const DashboardStats = React.memo(function DashboardStats({
  totalOrders,
  activeOrders,
  completedOrders,
  activeHelpersCount,
  totalHelpersCount,
  isHelperSimRunning,
  autoSim,
}: {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  activeHelpersCount: number;
  totalHelpersCount: number;
  isHelperSimRunning: boolean;
  autoSim: boolean;
}) {
  return (
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
          {activeHelpersCount}
        </span>
        <span className="text-xs text-slate-400">
          {isHelperSimRunning
            ? `${activeHelpersCount} active / ${totalHelpersCount} total`
            : `Paused · ${activeHelpersCount} active / ${totalHelpersCount} total`}
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
  );
});

// Memoized Control Buttons Panel
export const ControlButtons = React.memo(function ControlButtons({
  onCreateBatchOrders,
  onAdvanceOrders,
  onToggleAutoSim,
  autoSim,
  onResetOrders,
  onToggleHelperSim,
  isHelperSimRunning,
  onToggleStressTest,
  stressTestMode,
  onToggleHomeMode,
  homeMode,
  onToggleLaundryFailure,
  laundryFailureMode,
}: {
  onCreateBatchOrders: () => void;
  onAdvanceOrders: () => void;
  onToggleAutoSim: () => void;
  autoSim: boolean;
  onResetOrders: () => void;
  onToggleHelperSim: () => void;
  isHelperSimRunning: boolean;
  onToggleStressTest: () => void;
  stressTestMode: boolean;
  onToggleHomeMode: () => void;
  homeMode: boolean;
  onToggleLaundryFailure: () => void;
  laundryFailureMode: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-emerald-200 uppercase hover:bg-emerald-400/20 transition-colors"
        onClick={onCreateBatchOrders}
      >
        Spawn 5 new orders
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-sky-400/70 bg-sky-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-sky-200 uppercase hover:bg-sky-400/20 transition-colors"
        onClick={onAdvanceOrders}
      >
        Advance simulation
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-slate-500/80 bg-slate-900/40 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-slate-300 uppercase hover:bg-slate-800/80 transition-colors"
        onClick={onToggleAutoSim}
      >
        {autoSim ? "Disable auto simulation" : "Enable auto simulation"}
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-red-400/60 bg-red-500/5 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-red-300 uppercase hover:bg-red-500/10 transition-colors"
        onClick={onResetOrders}
      >
        Reset orders
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-amber-400/70 bg-amber-400/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-amber-200 uppercase hover:bg-amber-400/20 transition-colors"
        onClick={onToggleHelperSim}
      >
        {isHelperSimRunning ? "Pause helper sim" : "Resume helper sim"}
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-fuchsia-400/70 bg-fuchsia-500/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-fuchsia-100 uppercase hover:bg-fuchsia-500/20 transition-colors"
        onClick={onToggleStressTest}
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
        onClick={onToggleHomeMode}
      >
        {homeMode
          ? "Helper choice: Go home (purple)"
          : "Helper choice: Take orders (blue)"}
      </button>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-full border border-orange-400/70 bg-orange-500/10 px-4 py-2.5 text-xs font-medium tracking-[0.18em] text-orange-100 uppercase hover:bg-orange-500/20 transition-colors"
        onClick={onToggleLaundryFailure}
      >
        {laundryFailureMode ? "Laundry Failure: ON" : "Laundry Failure: OFF"}
      </button>
    </div>
  );
});

// Recent Orders List (Needs 'now' so it updates every second)
export function RecentOrdersList({
  recentOrders,
  houseClients,
  laundryLocations,
  helperIntegrity,
  orders,
  now,
  routingEngineState,
  onOrderClick,
}: {
  recentOrders: Order[];
  houseClients: HouseClient[];
  laundryLocations: LaundryLocation[];
  helperIntegrity: Record<string, HelperIntegrity>;
  orders: Order[];
  now: number;
  routingEngineState: RoutingEngineState;
  onOrderClick: (orderId: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
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
                    onOrderClick(order.id);
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
    </div>
  );
}

// Memoized Completed Orders List
export const CompletedOrdersList = React.memo(function CompletedOrdersList({
  completedRecentOrders,
  houseClients,
  laundryLocations,
  homeMode,
}: {
  completedRecentOrders: Order[];
  houseClients: HouseClient[];
  laundryLocations: LaundryLocation[];
  homeMode: boolean;
}) {
  return (
    <div className="mt-3 border-t border-white/10 pt-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
        <span className="order-card-title">Completed Orders</span>
        <span>{completedRecentOrders.length} total</span>
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
    </div>
  );
});

// Memoized Asset Protection Panel
export const AssetProtectionPanel = React.memo(function AssetProtectionPanel({
  latestAssetStatus,
  latestTrunkUnlocked,
  latestRoutingAssignments,
  serviceException,
  mechanicalOverrideEnabled,
  latestAssetOrderId,
  latestRescueAssignment,
  latestRescueEtaLabel,
}: {
  latestAssetStatus: string | null;
  latestTrunkUnlocked: boolean;
  latestRoutingAssignments: any[];
  serviceException: string | null;
  mechanicalOverrideEnabled: boolean;
  latestAssetOrderId: string | null;
  latestRescueAssignment: any;
  latestRescueEtaLabel: string | null;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
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
  );
});

// Helper Status List (Needs 'now' for earnings calculation)
export function HelperStatusList({
  helperSim,
  helpers,
  helperIntegrity,
  homeMode,
  laundryLocations,
  now,
}: {
  helperSim: HelperSimApi;
  helpers: Helper[];
  helperIntegrity: Record<string, HelperIntegrity>;
  homeMode: boolean;
  laundryLocations: LaundryLocation[];
  now: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
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
  );
}

// Memoized Helper Events List
export const HelperEventsList = React.memo(function HelperEventsList({
  logs,
}: {
  logs: any[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-3.5 py-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-slate-400 tracking-[0.22em] uppercase">
        <span>Helper Events</span>
        <span>{logs.length} events</span>
      </div>
      <div className="mt-1 max-h-32 overflow-y-auto space-y-1.5 text-[0.7rem] sm:text-xs">
        {logs.length === 0 ? (
          <div className="text-slate-500">No recent events.</div>
        ) : (
          logs.slice(0, 8).map((entry) => {
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
                  {new Date(entry.timestamp).toLocaleTimeString("en-US", {
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
    </div>
  );
});
