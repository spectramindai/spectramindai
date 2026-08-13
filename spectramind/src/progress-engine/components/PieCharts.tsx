import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ComplianceSummary } from "../utils/progressTypes";

export interface PieChartsProps {
  summary: ComplianceSummary;
}

const colors = ["#2563eb", "#e2e8f0"];

/** Renders completion pie charts for major compliance dimensions. */
export function PieCharts({ summary }: PieChartsProps) {
  const charts = [
    ["Controls", summary.controlCompletion.completed, summary.controlCompletion.total],
    ["Evidence", summary.evidenceCoverage.completed, summary.evidenceCoverage.total],
    ["Policies", summary.policyCoverage.completed, summary.policyCoverage.total],
    ["Risks", summary.riskCoverage.completed, summary.riskCoverage.total],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {charts.map(([label, completed, total]) => {
        const remaining = Math.max(total - completed, 0);
        const data = [
          { name: "Complete", value: completed },
          { name: "Remaining", value: remaining },
        ];

        return (
          <article key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">{label}</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2}>
                    {data.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>
        );
      })}
    </div>
  );
}

