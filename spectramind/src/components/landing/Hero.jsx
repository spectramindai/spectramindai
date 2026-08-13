import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import heroArt from "../../assets/hero.png";

const readinessItems = [
  ["SOC 2", "78%", "Evidence due in 4 days"],
  ["ISO 27001", "64%", "Risk review active"],
  ["CMMC", "91%", "Policies approved"],
];

const activity = [
  "Password policy evidence approved",
  "Vendor risk review assigned",
  "AI mapped 6 controls to SOC 2",
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-10 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_18%_18%,rgba(216,180,109,.28),transparent_26rem),radial-gradient(circle_at_82%_14%,rgba(255,255,255,.9),transparent_25rem)]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-blue-600/20 bg-white/55 px-4 py-2 text-sm font-black uppercase tracking-widest text-blue-700 shadow-lg shadow-blue-600/10 backdrop-blur">
            <Sparkles size={16} />
            Compliance operations, ready for audit week
          </div>

          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.03] tracking-normal text-slate-900 md:text-6xl">
            Run compliance, risk, vendors, and trust from one calm workspace.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            SpectraMind gives security teams a live operating system for
            controls, evidence, risk decisions, vendor reviews, and customer
            trust reporting.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-6 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5"
            >
              Get Started
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/testimonials"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-blue-600/25 bg-white/60 px-6 font-bold text-slate-800 shadow-lg shadow-slate-900/5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/85 hover:text-blue-700"
            >
              View Product
            </Link>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 text-sm font-semibold text-slate-600 sm:grid-cols-3">
            {["Control ownership", "Evidence workflows", "Trust center updates"].map((item) => (
              <div key={item} className="flex min-h-12 items-center gap-2 rounded-lg border border-white/70 bg-white/45 px-3 shadow-lg shadow-slate-900/5 backdrop-blur">
                <CheckCircle2 size={17} className="text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[520px]">
          <img
            src={heroArt}
            alt=""
            className="absolute right-2 top-4 hidden w-32 opacity-55 lg:block"
          />

          <div className="absolute inset-0 overflow-hidden rounded-lg border border-white/80 bg-[#fffdf8] shadow-2xl shadow-slate-900/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,255,255,.95),transparent_12rem),radial-gradient(circle_at_52%_58%,rgba(216,180,109,.24),transparent_18rem),linear-gradient(135deg,rgba(255,255,255,.64),rgba(236,231,220,.55))]" />
            <div className="absolute right-5 top-5 h-24 w-24 border border-blue-300/60 bg-[linear-gradient(135deg,rgba(255,255,255,.74),rgba(216,180,109,.18)),linear-gradient(45deg,transparent_47%,rgba(255,255,255,.78)_50%,transparent_53%)] opacity-80 [clip-path:polygon(50%_0,92%_24%,78%_84%,50%_100%,22%_84%,8%_24%)]" />

            <div className="absolute left-[11%] top-[18%] h-52 w-40 rotate-[-9deg] rounded-lg border border-white/85 bg-[linear-gradient(135deg,rgba(255,255,255,.76),rgba(244,223,174,.2)),repeating-linear-gradient(0deg,transparent_0_18px,rgba(157,111,56,.08)_19px_20px)] shadow-xl shadow-slate-900/10" />
            <div className="absolute bottom-[14%] right-[12%] h-52 w-40 rotate-[11deg] rounded-lg border border-white/85 bg-[linear-gradient(135deg,rgba(255,255,255,.76),rgba(244,223,174,.2)),repeating-linear-gradient(0deg,transparent_0_18px,rgba(157,111,56,.08)_19px_20px)] shadow-xl shadow-slate-900/10" />

            <div className="absolute left-1/2 top-1/2 h-[42%] w-[78%] -translate-x-1/2 -translate-y-1/2 rotate-[-12deg] rounded-[50%] border border-blue-600/25" />
            <div className="absolute left-1/2 top-1/2 h-[34%] w-[62%] -translate-x-1/2 -translate-y-1/2 rotate-[18deg] rounded-[50%] border border-emerald-600/20" />

            <div className="absolute left-1/2 top-1/2 aspect-[.58] w-[min(28vw,190px)] min-w-32 -translate-x-1/2 -translate-y-1/2 drop-shadow-2xl">
              <div className="absolute inset-0 border border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,.92),rgba(216,180,109,.28)_42%,rgba(142,175,153,.24)),linear-gradient(45deg,transparent_36%,rgba(255,255,255,.76)_49%,transparent_63%)] [clip-path:polygon(50%_0,90%_38%,50%_100%,10%_38%)]" />
              <div className="absolute inset-0 scale-[.72] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,.58),rgba(200,131,114,.22))] opacity-85 [clip-path:polygon(50%_0,90%_38%,50%_100%,10%_38%)]" />
              <div className="absolute inset-0 scale-x-[.42] border border-white/60 bg-white/30 [clip-path:polygon(50%_0,90%_38%,50%_100%,10%_38%)]" />
              <div className="absolute inset-x-[12%] bottom-[5%] h-[28%] bg-emerald-600/15 [clip-path:polygon(50%_100%,0_0,100%_0)]" />
            </div>

            <ArtifactCard className="bottom-6 left-6" label="Trust score" value="94%" />
            <ArtifactCard className="right-6 top-24" label="Evidence sync" value="Live" />
            <ArtifactCard className="bottom-7 right-[18%] hidden sm:grid" label="Coverage" value="Ready" />

            <div className="absolute left-5 right-5 top-5 hidden max-w-md rounded-lg border border-white/80 bg-white/62 p-4 shadow-lg shadow-slate-900/10 backdrop-blur md:block">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">Audit Readiness</p>
                  <h2 className="text-2xl font-black text-slate-900">78% ready</h2>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                  On track
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {readinessItems.map(([name, value, note]) => (
                  <div key={name} className="rounded-lg border border-slate-200 bg-white/62 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-bold text-slate-900">{name}</span>
                      <span className="text-sm font-black text-blue-700">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[linear-gradient(90deg,#8eaf99,#d8b46d)]" style={{ width: value }} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-5 left-1/2 hidden w-[min(340px,calc(100%_-_40px))] -translate-x-1/2 rounded-lg border border-white/80 bg-white/65 p-4 shadow-lg shadow-slate-900/10 backdrop-blur md:block">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-700" />
                <h3 className="font-black text-slate-900">Recent Activity</h3>
              </div>
              <div className="grid gap-2">
                {activity.map((item) => (
                  <div key={item} className="flex gap-3 text-sm text-slate-600">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArtifactCard({ className, label, value }) {
  return (
    <div className={`absolute z-20 w-36 gap-1 rounded-lg border border-blue-600/30 bg-[#fffdf8]/80 p-4 shadow-xl shadow-slate-900/15 backdrop-blur ${className}`}>
      <small className="text-xs font-bold text-slate-500">{label}</small>
      <strong className="text-2xl font-black text-blue-700">{value}</strong>
      <span className="block h-1.5 rounded-full bg-[linear-gradient(90deg,#d8b46d,rgba(255,255,255,.9))]" />
    </div>
  );
}
