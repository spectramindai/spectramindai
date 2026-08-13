import { useMemo } from "react";
import { CMMCImplementationLayout, useCMMCWorkspaceFilters } from "../components";
import { useCMMCSPRSCalculation } from "../hooks";

export default function CMMCSPRSScorePage() {
  const { searchQuery, domainFilter, resetVersion, statusFilter } = useCMMCWorkspaceFilters();
  return (
    <CMMCImplementationLayout>
      <CMMCSPRSScoreContent
        key={resetVersion}
        searchQuery={searchQuery}
        domainFilter={domainFilter}
        statusFilter={statusFilter}
      />
    </CMMCImplementationLayout>
  );
}

function CMMCSPRSScoreContent({ searchQuery, domainFilter, statusFilter }) {
  const sprsMetrics = useCMMCSPRSCalculation();
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const scoreRange = sprsMetrics.scoreRange || defaultScoreRange();
  const currentScore = Number(sprsMetrics.currentSPRSScore) || 0;
  const normalizedProgress = clampPercentage(Number(sprsMetrics.normalizedProgress) || 0);
  const readinessPercentage = clampPercentage(Number(sprsMetrics.readinessPercentage ?? sprsMetrics.completionPercentage) || 0);
  const scoreColor = getSmoothScoreColor(normalizedProgress);
  const controls = useMemo(
    () =>
      (sprsMetrics.controls || [])
        .map(normalizeControlRow)
        .sort((a, b) => b.pointsAtRisk - a.pointsAtRisk || b.deduction - a.deduction || a.controlId.localeCompare(b.controlId)),
    [sprsMetrics.controls]
  );
  const controlsRemaining = Number(sprsMetrics.openGapCount) || controls.filter((control) => !control.isReady).length;
  const partialCreditControls = controls.filter((control) => control.partialCreditEligible);
  const visibleControls = useMemo(
    () =>
      controls.filter((control) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            control.controlId,
            control.requirement,
            control.domainCode,
            control.domainName,
            control.displayStatus,
            control.pointsAtRisk,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesDomain = domainFilter === "all" || domainFilter === control.domainCode;
        const matchesStatus = statusFilter === "All" || statusFilter === control.displayStatus;

        return matchesSearch && matchesDomain && matchesStatus;
      }),
    [controls, domainFilter, normalizedSearch, statusFilter]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-lg bg-[#16162d] p-4 text-white shadow-xl shadow-slate-950/20">
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="text-xs font-black uppercase text-slate-300">SPRS Score</p>
            <p className="mt-3 text-6xl font-black leading-none transition-colors duration-700" style={{ color: scoreColor }}>
              {formatNumber(currentScore)}
            </p>
            <p className="mt-2 text-sm font-black transition-colors duration-700" style={{ color: scoreColor }}>
              {sprsMetrics.riskBand?.label || "Calculated"} readiness
            </p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-300">Score Position</p>
            <div className="mt-5 rounded-full bg-white/10 px-1 py-1">
              <div className="relative h-4 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-[width,background-color] duration-700 ease-out"
                  style={{ width: `${normalizedProgress}%`, backgroundColor: scoreColor }}
                />
                <span
                  className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-slate-100 shadow-lg shadow-black/20 transition-[left,border-color] duration-700 ease-out"
                  style={{ left: `${normalizedProgress}%`, borderColor: scoreColor }}
                />
              </div>
            </div>
            <div className="relative mt-2 h-5 text-[11px] font-bold text-slate-300">
              <ScaleLabel score={scoreRange.minimum} range={scoreRange} />
              <ScaleLabel score={scoreRange.baseline} range={scoreRange} />
              <ScaleLabel score={scoreRange.conditionalLevel2} range={scoreRange} />
              <ScaleLabel score={scoreRange.maximum} range={scoreRange} align="right" />
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-300">
              {formatNumber(scoreRange.conditionalLevel2)} = CMMC Level 2 eligible (conditional) | {formatNumber(scoreRange.baseline)} = FAR 52.204-21 baseline met
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <ScoreBox value={formatNumber(currentScore)} label="Current SPRS" />
          <ScoreBox value={formatNumber(sprsMetrics.pointsSecured)} label="Points Secured" tone="text-emerald-400" />
          <ScoreBox value={formatNumber(sprsMetrics.pointsAtRisk)} label="Points at Risk" tone="text-red-400" />
          <ScoreBox value={formatNumber(sprsMetrics.criticalGapCount)} label="Critical Gaps" tone="text-amber-300" />
          <ScoreBox value={`${readinessPercentage}%`} label="Readiness" tone="text-lime-300" />
        </div>
      </section>

      {partialCreditControls.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-[#fff3bf] p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950">Partial-credit controls</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {partialCreditControls.map((control) => (
              <PartialCreditStatus key={control.controlId} control={control} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="p-4">
          <h2 className="text-base font-black text-slate-900">Prioritized Remediation - Highest Point Value First</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {controlsRemaining} controls remaining ({readinessPercentage}% ready). Completing 5-point controls gives the fastest score improvement.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Control</th>
                <th className="px-4 py-3">Points at Risk</th>
                <th className="px-4 py-3">Requirement</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleControls.map((control) => (
                <tr key={control.controlId} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-violet-700">{control.controlId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 font-black ${control.pointsAtRisk ? "text-red-500" : "text-emerald-600"}`}>
                      <span className={`h-2 w-2 rounded-full ${control.pointsAtRisk ? "bg-red-500" : "bg-emerald-500"}`} />
                      {control.pointsAtRisk ? `-${control.pointsAtRisk}` : "0"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{control.requirement}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-violet-100 px-2 py-1 text-xs font-black text-violet-700">{control.domainCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{control.displayStatus}</span>
                  </td>
                </tr>
              ))}
              {visibleControls.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm font-semibold text-slate-500" colSpan={5}>
                    No remediation items match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScoreBox({ value, label, tone = "text-white" }) {
  return (
    <div className="rounded-md bg-white/8 p-4 text-center shadow-inner shadow-white/5">
      <p className={`text-3xl font-black leading-none ${tone}`}>{value}</p>
      <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-slate-300">{label}</p>
    </div>
  );
}

function PartialCreditStatus({ control }) {
  return (
    <div className="rounded border border-amber-200 bg-white px-3 py-2">
      <p className="text-sm font-black text-amber-950">{control.requirementId} - {control.title || control.controlId}</p>
      <p className="mt-1 text-xs font-bold text-slate-600">
        {control.displayStatus}: {control.pointsAtRisk ? `${control.pointsAtRisk} points at risk` : "no points at risk"}
      </p>
    </div>
  );
}

function ScaleLabel({ score, range, align = "center" }) {
  const position = scoreToPercent(score, range);
  const transform = align === "right" ? "-translate-x-full" : "-translate-x-1/2";
  return (
    <span className={`absolute top-0 ${transform}`} style={{ left: `${position}%` }}>
      {formatNumber(score)}
    </span>
  );
}

function normalizeControlRow(control) {
  return {
    ...control,
    controlId: control.controlId || control.id || "",
    requirement: control.requirement || control.title || "",
    domainCode: control.domainCode || control.familyCode || "",
    domainName: control.domainName || control.familyName || "",
    displayStatus: control.displayStatus || displayStatus(control.status),
    pointsAtRisk: Number(control.pointsAtRisk) || 0,
    pointsSecured: Number(control.pointsSecured) || 0,
    deduction: Number(control.deduction ?? control.points) || 0,
    isReady: Boolean(control.isReady),
  };
}

function displayStatus(status) {
  return {
    IMPLEMENTED: "Completed",
    NOT_APPLICABLE: "Not Applicable",
    PARTIALLY_IMPLEMENTED: "Partially Implemented",
    IN_PROGRESS: "In Progress",
    PLANNED: "Planned",
    NOT_STARTED: "Not Started",
  }[status] || "Not Started";
}

function scoreToPercent(score, range) {
  const minimum = Number(range.minimum);
  const maximum = Number(range.maximum);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum === maximum) return 0;
  return clampPercentage(((Number(score) - minimum) / (maximum - minimum)) * 100);
}

function clampPercentage(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function getSmoothScoreColor(progress) {
  const stops = [
    { at: 0, color: "#dc2626" },
    { at: 32, color: "#f97316" },
    { at: 65, color: "#eab308" },
    { at: 93, color: "#84cc16" },
    { at: 100, color: "#16a34a" },
  ];
  const value = clampPercentage(progress);
  const upperIndex = stops.findIndex((stop) => value <= stop.at);
  if (upperIndex <= 0) return stops[0].color;
  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const ratio = (value - lower.at) / (upper.at - lower.at);
  return interpolateHexColor(lower.color, upper.color, ratio);
}

function interpolateHexColor(from, to, ratio) {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  const rgb = start.map((value, index) => Math.round(value + (end[index] - value) * ratio));
  return `rgb(${rgb.join(", ")})`;
}

function hexToRgb(value) {
  const hex = String(value).replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "0";
}

function defaultScoreRange() {
  return {
    minimum: -203,
    baseline: 0,
    conditionalLevel2: 88,
    maximum: 110,
  };
}
