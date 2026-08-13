import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "../layout/AppShell";

export default function ComplianceModulePage({
  eyebrow,
  title,
  description,
  icon: Icon,
  metrics,
  items,
  actionLabel,
  emptyMessage = "No current work.",
  renderItemActions,
}) {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="space-y-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-blue-700">
              {eyebrow}
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-900">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              {description}
            </p>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-5 py-3 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5">
            {actionLabel}
            <ArrowUpRight size={18} />
          </button>
        </div>

        <section className="rounded-lg border border-white/75 bg-white/62 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
                <Icon size={24} />
              </div>
              <h2 className="mt-5 text-2xl font-black text-slate-900">
                {title} overview
              </h2>
              <p className="mt-2 leading-7 text-slate-600">
                Keep owners, status, and upcoming work visible without opening multiple systems.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-[#fffdf8]/72 p-4"
                >
                  <p className="text-sm font-medium text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-white/75 bg-white/62 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-xl font-black text-slate-900">
              Current work
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {items.length ? items.map((item) => (
              <div
                key={item.id || item.title}
                onClick={() => item.path && navigate(item.path)}
                onKeyDown={(event) => {
                  if (item.path && (event.key === "Enter" || event.key === " ")) navigate(item.path);
                }}
                role={item.path ? "button" : undefined}
                tabIndex={item.path ? 0 : undefined}
                className={`grid gap-4 px-6 py-5 lg:grid-cols-[1fr_160px_140px] ${
                  item.path ? "cursor-pointer transition hover:bg-blue-50/40" : ""
                }`}
              >
                <div className="flex gap-3">
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-500"
                  />
                  <div>
                    <h3 className="font-black text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>

                <p className="text-sm font-semibold text-slate-600">
                  {item.owner}
                </p>
                {renderItemActions ? (
                  renderItemActions(item)
                ) : (
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
                    {item.status}
                  </span>
                )}
              </div>
            )) : (
              <div className="px-6 py-10 text-center text-sm font-semibold text-slate-500">
                {emptyMessage}
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
