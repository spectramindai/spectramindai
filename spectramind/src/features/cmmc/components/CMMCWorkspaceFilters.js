import { useEffect, useMemo, useState } from "react";

const workspaceFilterState = {
  searchQuery: "",
  domainFilter: "all",
  statusFilter: "All",
  resetVersion: 0,
};
const workspaceFilterListeners = new Set();

function updateWorkspaceFilterState(nextState) {
  Object.assign(workspaceFilterState, nextState);
  workspaceFilterListeners.forEach((listener) => listener({ ...workspaceFilterState }));
}

export function useCMMCWorkspaceFilters() {
  const [snapshot, setSnapshot] = useState({ ...workspaceFilterState });

  useEffect(() => {
    workspaceFilterListeners.add(setSnapshot);

    return () => workspaceFilterListeners.delete(setSnapshot);
  }, []);

  return useMemo(
    () => ({
      ...snapshot,
      setSearchQuery: (searchQuery) => updateWorkspaceFilterState({ searchQuery }),
      setDomainFilter: (domainFilter) => updateWorkspaceFilterState({ domainFilter }),
      setStatusFilter: (statusFilter) => updateWorkspaceFilterState({ statusFilter }),
      resetWorkspace: () =>
        updateWorkspaceFilterState({
          searchQuery: "",
          domainFilter: "all",
          statusFilter: "All",
          resetVersion: workspaceFilterState.resetVersion + 1,
        }),
    }),
    [snapshot]
  );
}
