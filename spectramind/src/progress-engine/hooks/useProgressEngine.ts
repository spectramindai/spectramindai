import { useMemo } from "react";
import type { ProgressInput } from "../utils/progressTypes";
import { ProgressEngineService } from "../services";

/** Calculates compliance progress whenever implementation input data changes. */
export function useProgressEngine(input: ProgressInput) {
  const engine = useMemo(() => new ProgressEngineService(), []);
  const summary = useMemo(() => engine.generateComplianceSummary(input), [engine, input]);

  return {
    engine,
    summary,
    calculateControlProgress: engine.calculateControlProgress.bind(engine),
    calculateFrameworkProgress: engine.calculateFrameworkProgress.bind(engine),
    calculateOverallScore: engine.calculateOverallScore.bind(engine),
    calculateReadiness: engine.calculateReadiness.bind(engine),
    calculateEvidenceCoverage: engine.calculateEvidenceCoverage.bind(engine),
    generateComplianceSummary: engine.generateComplianceSummary.bind(engine),
  };
}

