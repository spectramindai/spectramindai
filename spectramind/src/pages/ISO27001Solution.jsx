import { ArrowRight, BookOpenCheck, CheckCircle2, FileLock2, Waypoints } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const steps = [
  "Define ISMS ownership",
  "Map controls and policies",
  "Collect implementation evidence",
  "Track risks and corrective actions",
];

export default function ISO27001Solution() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                ISO 27001
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
                Build a cleaner operating system for your ISMS.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Bring ISO 27001 controls, policy work, evidence, ownership, and
                risk treatment into a single workspace your team can maintain.
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
                  to="/contact"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-800 transition hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950"
                >
                  Talk to Us
                </Link>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950">
              <div className="grid gap-4">
                <Highlight icon={BookOpenCheck} title="Control library" copy="Organize clauses, policies, and evidence in a traceable system." />
                <Highlight icon={FileLock2} title="Evidence discipline" copy="See what is approved, missing, expired, or waiting on an owner." />
                <Highlight icon={Waypoints} title="Risk treatment" copy="Keep remediation work connected to controls and business context." />
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 md:grid-cols-4">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                    {index + 1}
                  </div>
                  <p className="mt-5 font-semibold text-slate-950 dark:text-white">
                    {step}
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

function Highlight({ icon: Icon, title, copy }) {
  return (
    <div className="rounded-lg bg-slate-50 p-5 dark:bg-slate-900">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
          <Icon size={22} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{copy}</p>
        </div>
      </div>
    </div>
  );
}
