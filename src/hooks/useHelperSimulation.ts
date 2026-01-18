import { useState, useEffect } from "react";
import { helpers, HelperSimConfig, HelperSimApi, HelperSimEntry, HelperSimLogEntry, HelperStatus } from "../utils/constants";
import { createRandomInRange } from "../utils/helpers";

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
