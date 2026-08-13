import { ArrowRight, BrainCircuit, FileCheck2, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";

const queues = [
  { label: "Evidence requests", value: "18", icon: FileCheck2, tone: "text-blue-700" },
  { label: "Open risks", value: "5", icon: TriangleAlert, tone: "text-rose-600" },
  { label: "AI answers", value: "43", icon: BrainCircuit, tone: "text-violet-600" },
];

const rows = [
  ["Access review", "Ready", "SOC 2 CC6.2"],
  ["Incident response policy", "Needs owner", "ISO A.5.24"],
  ["Vendor renewal", "Due soon", "CMMC"],
  ["Risk treatment plan", "In review", "SOC 2 CC3.2"],
];

export default function DashboardPreview() {
  return (
    <section className="px-6 py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">
            Product Preview
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            See the work, the owners, and the next decision.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Your team gets a clean cockpit for readiness, evidence collection,
            risk response, and vendor follow-up without digging through tabs.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/testimonials"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-6 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5"
            >
              Explore the Product
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-blue-600/25 bg-white/60 px-6 font-bold text-slate-800 shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:bg-white/85 hover:text-blue-700"
            >
              View Pricing
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-white/80 bg-white/48 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur">
          <div className="rounded-lg border border-white/70 bg-[#fffdf8]/82 p-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500">
                  Compliance Command Center
                </p>
                <h3 className="text-2xl font-black text-slate-900">
                  Today&apos;s audit queue
                </h3>
              </div>
              <div className="rounded-lg border border-blue-600/20 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
                12 items resolved
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {queues.map((queue) => {
                const Icon = queue.icon;

                return (
                  <div
                    key={queue.label}
                    className="rounded-lg border border-slate-200 bg-white/55 p-4"
                  >
                    <Icon size={20} className={queue.tone} />
                    <p className="mt-4 text-3xl font-black text-slate-900">
                      {queue.value}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {queue.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white/35">
              {rows.map(([name, status, framework]) => (
                <div
                  key={name}
                  className="grid grid-cols-[1fr_auto] gap-4 border-b border-slate-200 px-4 py-3 last:border-b-0 md:grid-cols-[1fr_140px_120px]"
                >
                  <p className="font-bold text-slate-900">{name}</p>
                  <p className="text-sm font-medium text-slate-600">
                    {status}
                  </p>
                  <p className="hidden text-sm text-slate-500 md:block">
                    {framework}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
