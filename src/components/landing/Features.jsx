import {
  Bot,
  Building2,
  ClipboardCheck,
  FileArchive,
  Radar,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "Control Management",
    description:
      "Assign owners, map controls to frameworks, and see what is ready, blocked, or due.",
  },
  {
    icon: FileArchive,
    title: "Evidence Repository",
    description:
      "Collect audit artifacts in structured workflows with status, owner, and review context.",
  },
  {
    icon: Radar,
    title: "Risk Scenarios",
    description:
      "Use questionnaire-driven framework risk scenarios to prioritize mitigation work.",
  },
  {
    icon: Building2,
    title: "Vendor Reviews",
    description:
      "Keep third-party security questionnaires, renewals, and risk posture in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Trust Center",
    description:
      "Publish the right security posture to customers while keeping sensitive evidence gated.",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description:
      "Ask about controls, policies, risks, and evidence to get faster compliance answers.",
  },
];

export default function Features() {
  return (
    <section className="px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-widest text-emerald-700">
            Platform
          </p>
          <h2 className="mt-3 text-4xl font-black text-slate-900 md:text-5xl">
            The daily workspace for compliance teams.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Replace scattered spreadsheets, drive-by chat requests, and audit
            scramble with a shared system of record for security operations.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-emerald-500/10 bg-white/72 p-6 shadow-xl shadow-slate-900/5 backdrop-blur transition hover:-translate-y-1 hover:border-emerald-500/35 hover:bg-white"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <Icon size={22} />
                </div>

                <h3 className="text-xl font-black text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
