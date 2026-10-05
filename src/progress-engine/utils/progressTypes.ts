export type ProgressStatus = "not_started" | "in_progress" | "implemented" | "not_applicable" | "approved" | "missing" | "uploaded" | "rejected" | "done" | "open" | "blocked" | "archived";
export type RiskSeverity = "low" | "medium" | "high" | "critical" | string;

export interface ProgressControl {
  id: string;
  status?: ProgressStatus;
}

export interface ProgressEvidence {
  id: string;
  status?: ProgressStatus;
  relatedControlIds?: string[];
  dueDate?: string;
}

export interface ProgressPolicy {
  id: string;
  status?: ProgressStatus;
  relatedControlIds?: string[];
}

export interface ProgressRisk {
  id: string;
  status?: ProgressStatus;
  severity?: RiskSeverity;
  relatedControlIds?: string[];
}

export interface ProgressTest {
  id: string;
  status?: ProgressStatus;
  relatedControlIds?: string[];
}

export interface ProgressTask {
  id: string;
  status?: ProgressStatus;
  dueDate?: string;
  relatedControlIds?: string[];
}

export interface ProgressInput {
  controls: ProgressControl[];
  evidence: ProgressEvidence[];
  policies: ProgressPolicy[];
  risks: ProgressRisk[];
  tests: ProgressTest[];
  tasks: ProgressTask[];
  today?: string;
}

export interface MetricResult {
  total: number;
  completed: number;
  percent: number;
}

export interface ComplianceSummary {
  controlCompletion: MetricResult;
  frameworkCompletion: MetricResult;
  policyCoverage: MetricResult;
  evidenceCoverage: MetricResult;
  riskCoverage: MetricResult;
  testCompletion: MetricResult;
  taskCompletion: MetricResult;
  overallComplianceScore: number;
  auditReadinessScore: number;
  missingControls: ProgressControl[];
  pendingEvidence: ProgressEvidence[];
  overdueTasks: ProgressTask[];
  riskBreakdown: Record<string, number>;
}

export interface TrendPoint {
  label: string;
  score: number;
}

