import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ComplianceChart({ data = [], delta = 0 }) {
  const chartData = data.length ? data : [{ label: "Current", score: 0 }];

  return (
    <div className="rounded-lg border border-white/75 bg-white/62 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            Compliance Progress
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Monthly readiness score across active frameworks
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
          {delta >= 0 ? "+" : ""}{delta} pts
        </span>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,80,62,.16)" />
            <XAxis dataKey="label" stroke="#746b5d" />
            <YAxis stroke="#746b5d" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#9d6f38"
              strokeWidth={4}
              dot={{ r: 5, fill: "#d8b46d", strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
