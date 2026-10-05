import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "../utils/progressTypes";

export interface TrendGraphProps {
  data: TrendPoint[];
}

/** Displays compliance score movement over time. */
export function TrendGraph({ data }: TrendGraphProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-900">Compliance Trend</p>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

