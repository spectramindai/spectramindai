import { CircleCheck, Clock3, LockKeyhole, Waypoints } from "lucide-react";

const outcomes = [
  {
    icon: Clock3,
    title: "Less audit scramble",
    description:
      "Teams see missing evidence, overdue reviews, and stale controls before the auditor asks.",
  },
  {
    icon: Waypoints,
    title: "One source of truth",
    description:
      "Controls, policies, vendors, risks, and customer-facing trust data stay connected.",
  },
  {
    icon: LockKeyhole,
    title: "Designed for trust",
    description:
      "Share proof confidently with clean approvals, gated evidence, and clear ownership.",
  },
];

const workflow = [
  "Map frameworks",
  "Assign owners",
  "Collect evidence",
  "Review posture",
  "Publish trust",
];

export default function WhySpectraMind() {
  return (
    <section className="border-y border-white/70 bg-white/30 px-6 py-24 backdrop-blur lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-blue-700">
            Why SpectraMind
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
            Make compliance feel like an operating rhythm.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            SpectraMind is built around the work security teams do every week:
            assigning owners, proving controls, resolving risk, and answering
            customer trust questions.
          </p>
        </div>

        <div className="rounded-lg border border-white/75 bg-white/62 p-4 shadow-xl shadow-slate-900/10 backdrop-blur">
          <div className="grid gap-3 md:grid-cols-5">
            {workflow.map((step, index) => (
              <div
                key={step}
                className="rounded-lg border border-slate-200 bg-[#fffdf8]/70 p-4"
              >
                <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4dfae,#9d6f38)] text-sm font-black text-slate-900">
                  {index + 1}
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="grid gap-5 md:grid-cols-3">
            {outcomes.map((outcome) => {
              const Icon = outcome.icon;

              return (
                <div
                  key={outcome.title}
                  className="rounded-lg border border-white/75 bg-white/58 p-6 shadow-xl shadow-slate-900/5 backdrop-blur"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-600/15 bg-emerald-50 text-emerald-700">
                      <Icon size={20} />
                    </div>
                    <CircleCheck size={18} className="text-emerald-500" />
                  </div>

                  <h3 className="text-xl font-black text-slate-900">
                    {outcome.title}
                  </h3>

                  <p className="mt-3 leading-7 text-slate-600">
                    {outcome.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
