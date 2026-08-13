import { ArrowRight, CheckCircle2, ClipboardCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const capabilities = [
  "Control mapping across SOC 2 trust service criteria",
  "Evidence collection with owners, due dates, and review status",
  "Risk tracking for remediation and audit conversations",
  "Vendor review visibility for third-party assurance",
];

export default function SOC2Solution() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                SOC 2 Compliance
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
                Keep your SOC 2 program audit-ready all year.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                SpectraMind helps teams manage controls, evidence, risks, vendors,
                and trust reporting in one operating rhythm for SOC 2 readiness.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Get Started
                  <ArrowRight size={18} />
                </Link>
                <Link
                  to="/testimonials"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950"
                >
                  View Product
                </Link>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950">
              <div className="rounded-xl bg-blue-600 p-6 text-white">
                <ShieldCheck size={30} />
                <h2 className="mt-5 text-3xl font-bold">78% audit ready</h2>
                <p className="mt-2 text-blue-100">
                  Evidence gaps, overdue controls, and vendor tasks are visible before audit week.
                </p>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Metric icon={ClipboardCheck} label="Controls mapped" value="42" />
                <Metric icon={FileCheck2} label="Evidence files" value="124" />
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 md:grid-cols-4">
              {capabilities.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <CheckCircle2 className="text-emerald-500" size={22} />
                  <p className="mt-4 font-semibold leading-7 text-slate-900 dark:text-white">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <Icon size={22} className="text-blue-600 dark:text-blue-300" />
      <p className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
