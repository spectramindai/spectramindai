import type {
  ComplianceSummary,
  MetricResult,
  ProgressControl,
  ProgressEvidence,
  ProgressInput,
  ProgressPolicy,
  ProgressRisk,
  ProgressTask,
} from "../utils/progressTypes";
import { toPercent, weightedAverage } from "../utils/math";

const completedControlStatuses = new Set(["implemented", "not_applicable"]);
const completedEvidenceStatuses = new Set(["approved"]);
const completedPolicyStatuses = new Set(["approved", "implemented"]);
const completedRiskStatuses = new Set(["implemented", "not_applicable"]);
const completedTestStatuses = new Set(["implemented", "not_applicable", "done"]);
const completedTaskStatuses = new Set(["done", "archived"]);

/** Calculates compliance progress and readiness from organization implementation data. */
export class ProgressEngineService {
  /** Calculates completion for controls only. */
  calculateControlProgress(controls: ProgressControl[]): MetricResult {
    const completed = controls.filter((control) => completedControlStatuses.has(control.status || "not_started")).length;
    return this.metric(completed, controls.length);
  }

  /** Calculates framework progress across controls, policies, evidence, risks, tests, and tasks. */
  calculateFrameworkProgress(input: ProgressInput): MetricResult {
    const control = this.calculateControlProgress(input.controls);
    const policy = this.calculateEvidenceCoverage(input.policies);
    const evidence = this.calculateEvidenceCoverage(input.evidence);
    const risk = this.calculateRiskCoverage(input.risks);
    const test = this.calculateTestProgress(input.tests);
    const task = this.calculateTaskProgress(input.tasks);
    return this.metric(
      control.completed + policy.completed + evidence.completed + risk.completed + test.completed + task.completed,
      control.total + policy.total + evidence.total + risk.total + test.total + task.total,
    );
  }

  /** Calculates the overall compliance score using weighted implementation signals. */
  calculateOverallScore(input: ProgressInput): number {
    return weightedAverage([
      { score: this.calculateControlProgress(input.controls).percent, weight: 0.3 },
      { score: this.calculateEvidenceCoverage(input.evidence).percent, weight: 0.25 },
      { score: this.calculateEvidenceCoverage(input.policies).percent, weight: 0.15 },
      { score: this.calculateRiskCoverage(input.risks).percent, weight: 0.15 },
      { score: this.calculateTaskProgress(input.tasks).percent, weight: 0.15 },
    ]);
  }

  /** Calculates audit readiness with heavier weight on controls, evidence, tests, and overdue work. */
  calculateReadiness(input: ProgressInput): number {
    const overduePenalty = Math.min(this.getOverdueTasks(input.tasks, input.today).length * 3, 20);
    const baseScore = weightedAverage([
      { score: this.calculateControlProgress(input.controls).percent, weight: 0.35 },
      { score: this.calculateEvidenceCoverage(input.evidence).percent, weight: 0.3 },
      { score: this.calculateTestProgress(input.tests).percent, weight: 0.2 },
      { score: this.calculateEvidenceCoverage(input.policies).percent, weight: 0.15 },
    ]);
    return Math.max(0, baseScore - overduePenalty);
  }

  /** Calculates coverage for evidence or policy records. */
  calculateEvidenceCoverage(items: Array<ProgressEvidence | ProgressPolicy>): MetricResult {
    const completed = items.filter((item) => completedEvidenceStatuses.has(item.status || "missing") || completedPolicyStatuses.has(item.status || "missing")).length;
    return this.metric(completed, items.length);
  }

  /** Calculates risk mitigation coverage. */
  calculateRiskCoverage(risks: ProgressRisk[]): MetricResult {
    const completed = risks.filter((risk) => completedRiskStatuses.has(risk.status || "not_started")).length;
    return this.metric(completed, risks.length);
  }

  /** Generates a full dashboard-ready compliance summary. */
  generateComplianceSummary(input: ProgressInput): ComplianceSummary {
    const controlCompletion = this.calculateControlProgress(input.controls);
    const frameworkCompletion = this.calculateFrameworkProgress(input);
    const policyCoverage = this.calculateEvidenceCoverage(input.policies);
    const evidenceCoverage = this.calculateEvidenceCoverage(input.evidence);
    const riskCoverage = this.calculateRiskCoverage(input.risks);
    const testCompletion = this.calculateTestProgress(input.tests);
    const taskCompletion = this.calculateTaskProgress(input.tasks);

    return {
      controlCompletion,
      frameworkCompletion,
      policyCoverage,
      evidenceCoverage,
      riskCoverage,
      testCompletion,
      taskCompletion,
      overallComplianceScore: this.calculateOverallScore(input),
      auditReadinessScore: this.calculateReadiness(input),
      missingControls: this.getMissingControls(input.controls),
      pendingEvidence: this.getPendingEvidence(input.evidence),
      overdueTasks: this.getOverdueTasks(input.tasks, input.today),
      riskBreakdown: this.getRiskBreakdown(input.risks),
    };
  }

  /** Returns controls that are not complete or marked not applicable. */
  getMissingControls(controls: ProgressControl[]): ProgressControl[] {
    return controls.filter((control) => !completedControlStatuses.has(control.status || "not_started"));
  }

  /** Returns evidence that is missing, uploaded but not approved, or rejected. */
  getPendingEvidence(evidence: ProgressEvidence[]): ProgressEvidence[] {
    return evidence.filter((item) => !completedEvidenceStatuses.has(item.status || "missing"));
  }

  /** Returns tasks whose due date has passed and are not complete. */
  getOverdueTasks(tasks: ProgressTask[], today = new Date().toISOString()): ProgressTask[] {
    const todayTime = new Date(today).getTime();
    return tasks.filter((task) => {
      if (!task.dueDate || completedTaskStatuses.has(task.status || "open")) return false;
      return new Date(task.dueDate).getTime() < todayTime;
    });
  }

  /** Calculates task completion. */
  calculateTaskProgress(tasks: ProgressTask[]): MetricResult {
    const completed = tasks.filter((task) => completedTaskStatuses.has(task.status || "open")).length;
    return this.metric(completed, tasks.length);
  }

  /** Calculates test completion. */
  calculateTestProgress(tests: ProgressInput["tests"]): MetricResult {
    const completed = tests.filter((test) => completedTestStatuses.has(test.status || "not_started")).length;
    return this.metric(completed, tests.length);
  }

  /** Counts risks by severity for dashboard summaries. */
  getRiskBreakdown(risks: ProgressRisk[]): Record<string, number> {
    return risks.reduce(
      (breakdown, risk) => {
        const severity = risk.severity || "unrated";
        breakdown[severity] = (breakdown[severity] || 0) + 1;
        return breakdown;
      },
      {} as Record<string, number>,
    );
  }

  private metric(completed: number, total: number): MetricResult {
    return { completed, total, percent: toPercent(completed, total) };
  }
}

export const progressEngine = new ProgressEngineService();

