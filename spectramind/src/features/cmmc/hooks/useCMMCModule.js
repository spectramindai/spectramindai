import { useMemo } from "react";
import { cmmcWorkspaceModules } from "../data/cmmcModules";

export default function useCMMCModule(moduleId) {
  return useMemo(
    () => cmmcWorkspaceModules.find((module) => module.id === moduleId) || null,
    [moduleId]
  );
}
