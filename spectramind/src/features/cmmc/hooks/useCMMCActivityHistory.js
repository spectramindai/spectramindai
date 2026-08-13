import { useEffect, useState } from "react";
import {
  CMMC_ACTIVITY_EVENT,
  hydrateCMMCActivityHistory,
  loadCMMCActivityHistory,
} from "../services/cmmcActivityHistoryService";

export function useCMMCActivityHistory() {
  const [activities, setActivities] = useState(() => loadCMMCActivityHistory());

  useEffect(() => {
    const refreshActivities = () => setActivities(loadCMMCActivityHistory());
    hydrateCMMCActivityHistory().catch(() => {});

    window.addEventListener(CMMC_ACTIVITY_EVENT, refreshActivities);
    window.addEventListener("spectramind:session-updated", refreshActivities);
    window.addEventListener("storage", refreshActivities);

    return () => {
      window.removeEventListener(CMMC_ACTIVITY_EVENT, refreshActivities);
      window.removeEventListener("spectramind:session-updated", refreshActivities);
      window.removeEventListener("storage", refreshActivities);
    };
  }, []);

  return activities;
}
