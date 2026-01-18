import { type ReactNode } from "react";
import React from "react";
import {
  type PlanId,
  type PlanMetrics,
  type PlanHistoryEntry,
  type LaundryLocation,
  type HouseClient,
  type Helper,
  type Vehicle,
} from "../utils/constants";

// Memoized Plan Option Button
const PlanOptionButton = React.memo(function PlanOptionButton({
  planId,
  metrics,
  onClick,
  colorClass,
  labelColorClass,
  hoverBorderClass,
  hoverBgClass,
  description,
  details,
}: {
  planId: PlanId;
  metrics: PlanMetrics | null;
  onClick: () => void;
  colorClass: string;
  labelColorClass: string;
  hoverBorderClass: string;
  hoverBgClass: string;
  description: string;
  details: (metrics: PlanMetrics) => string;
}) {
  return (
    <button
      type="button"
      className={`flex flex-col items-start gap-1 rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-left transition-colors ${hoverBorderClass} ${hoverBgClass}`}
      onClick={onClick}
    >
      <span className={`text-[0.7rem] font-semibold tracking-[0.22em] uppercase ${labelColorClass}`}>
        {planId}
      </span>
      <span className="text-[0.75rem] text-slate-100">
        {metrics
          ? `${Math.round(metrics.estimatedMinutes)} min | ${metrics.totalDistanceKm.toFixed(1)} km`
          : "Computing..."}
      </span>
      <span className="text-[0.65rem] text-slate-400">
        {metrics ? details(metrics) : description}
      </span>
    </button>
  );
});

// Memoized Plan Comparison Panel
const PlanComparison = React.memo(function PlanComparison({
  planMetrics,
  bestPlan,
  premiumTrustScore,
}: {
  planMetrics: PlanMetrics[] | null;
  bestPlan: PlanMetrics | null;
  premiumTrustScore: number | null;
}) {
  if (!planMetrics || planMetrics.length === 0) return null;

  return (
    <div className="rounded-2xl border border-sky-400/40 bg-slate-900/40 px-3.5 py-3 space-y-2">
      <div className="flex items-center justify-between text-[0.6rem] sm:text-[0.65rem] tracking-[0.22em] uppercase text-slate-300">
        <span>Plan Comparison · Chain of Custody / Fault Recovery first</span>
        <span className="text-sky-300">
          {bestPlan ? `Best by score: ${bestPlan.label}` : "Scoring plans"}
        </span>
      </div>
      <div className="space-y-1.5 text-[0.65rem] text-slate-200">
        {planMetrics.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2">
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
  );
});

// Memoized Route Context Panel
const RouteContext = React.memo(function RouteContext({
  selectedPlan,
  laundryLocations,
  vehicles,
  houseClients,
  helpers,
  planHistory,
}: {
  selectedPlan: PlanId | null;
  laundryLocations: LaundryLocation[];
  vehicles: Vehicle[];
  houseClients: HouseClient[];
  helpers: Helper[];
  planHistory: PlanHistoryEntry[];
}) {
  return (
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
  );
});

// Memoized Decision Center Component
export const DecisionCenter = React.memo(function DecisionCenter({
  decisionPhase,
  decisionStateLabel,
  onGenerateOrder,
  activeOrders,
  totalOrders,
  completedOrders,
  flashMetrics,
  ecoMetrics,
  premiumMetrics,
  lowestGuaranteePlanId,
  premiumTrustScore,
  planMetrics,
  bestPlan,
  onStartSimulation,
  selectedPlan,
  laundryLocations,
  vehicles,
  houseClients,
  helpers,
  planHistory,
}: {
  decisionPhase: "idle" | "loading" | "options" | "running" | "completed";
  decisionStateLabel: string;
  onGenerateOrder: () => void;
  activeOrders: number;
  totalOrders: number;
  completedOrders: number;
  flashMetrics: PlanMetrics | null;
  ecoMetrics: PlanMetrics | null;
  premiumMetrics: PlanMetrics | null;
  lowestGuaranteePlanId: PlanId | null;
  premiumTrustScore: number | null;
  planMetrics: PlanMetrics[] | null;
  bestPlan: PlanMetrics | null;
  onStartSimulation: (plan: PlanId) => void;
  selectedPlan: PlanId | null;
  laundryLocations: LaundryLocation[];
  vehicles: Vehicle[];
  houseClients: HouseClient[];
  helpers: Helper[];
  planHistory: PlanHistoryEntry[];
}) {
  return (
    <div className="space-y-3 sm:space-y-4 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.9)]" />
          <span className="tracking-[0.18em] uppercase text-slate-200">
            Decision State
          </span>
        </div>
        <span className="text-slate-300">{decisionStateLabel}</span>
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
            onClick={onGenerateOrder}
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

      {decisionPhase === "completed" ? (
        <div className="space-y-3">
          <p className="text-slate-400">
            Delivery completed. You can generate another simulation order to explore
            a new route.
          </p>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/70 bg-emerald-400/20 px-4 py-2.5 text-[0.75rem] sm:text-sm font-semibold tracking-[0.22em] text-emerald-50 uppercase hover:bg-emerald-400/30 hover:border-emerald-300 transition-colors"
            onClick={onGenerateOrder}
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
            <PlanOptionButton
              planId="Flash"
              metrics={flashMetrics}
              onClick={() => onStartSimulation("Flash")}
              colorClass="text-emerald-200"
              labelColorClass="text-emerald-200"
              hoverBorderClass="hover:border-emerald-300/80"
              hoverBgClass="hover:bg-emerald-400/10"
              description="Latency-first routing for urgent orders."
              details={(m) => `Eff ${Math.round(m.efficiency * 100)}% · Priority route`}
            />
            <PlanOptionButton
              planId="Eco"
              metrics={ecoMetrics}
              onClick={() => onStartSimulation("Eco")}
              colorClass="text-sky-200"
              labelColorClass="text-sky-200"
              hoverBorderClass="hover:border-sky-300/80"
              hoverBgClass="hover:bg-sky-400/10"
              description="Optimizing detour and subsidy savings."
              details={(m) =>
                lowestGuaranteePlanId === "Eco"
                  ? `GA ${Math.round(m.guaranteeAdjustment * 100)} (lowest) · Eff ${Math.round(m.efficiency * 100)}%`
                  : `GA ${Math.round(m.guaranteeAdjustment * 100)} · Eff ${Math.round(m.efficiency * 100)}%`
              }
            />
            <PlanOptionButton
              planId="Premium"
              metrics={premiumMetrics}
              onClick={() => onStartSimulation("Premium")}
              colorClass="text-amber-200"
              labelColorClass="text-amber-200"
              hoverBorderClass="hover:border-amber-300/80"
              hoverBgClass="hover:bg-amber-400/10"
              description="Evaluating distance, custody, and trust."
              details={(m) =>
                premiumTrustScore !== null
                  ? `Cust ${Math.round(m.chainOfCustodyScore * 100)} · Trust ${premiumTrustScore} · Eff ${Math.round(m.efficiency * 100)}%`
                  : `Cust ${Math.round(m.chainOfCustodyScore * 100)} · Eff ${Math.round(m.efficiency * 100)}%`
              }
            />
          </div>
          <PlanComparison
            planMetrics={planMetrics}
            bestPlan={bestPlan}
            premiumTrustScore={premiumTrustScore}
          />
        </div>
      ) : null}
      
      <RouteContext
        selectedPlan={selectedPlan}
        laundryLocations={laundryLocations}
        vehicles={vehicles}
        houseClients={houseClients}
        helpers={helpers}
        planHistory={planHistory}
      />
    </div>
  );
});
