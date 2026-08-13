import { BrainCircuit, CheckCircle2, ShieldCheck, UsersRound } from "lucide-react";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const values = [
  ["Clarity", "Make compliance work visible, owned, and understandable."],
  ["Trust", "Help teams prove their posture without exposing the wrong details."],
  ["Momentum", "Turn audit preparation into a steady operating rhythm."],
];

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              About SpectraMind
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
              We help teams turn compliance into a trustworthy daily workflow.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              SpectraMind is an AI-powered compliance and trust platform for
              managing controls, evidence, risks, vendors, and customer-facing
              assurance from a single workspace.
            </p>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            <Feature icon={ShieldCheck} title="Compliance-first" copy="Built around control ownership, evidence readiness, and framework mapping." />
            <Feature icon={BrainCircuit} title="AI-assisted" copy="Designed to help teams find answers faster across policies, risks, and controls." />
            <Feature icon={UsersRound} title="Team-oriented" copy="Gives security, compliance, leadership, and customer teams one shared view." />
          </div>

          <div className="mx-auto mt-10 grid max-w-7xl gap-4 md:grid-cols-3">
            {values.map(([title, copy]) => (
              <div key={title} className="rounded-lg bg-slate-50 p-6 dark:bg-slate-900">
                <CheckCircle2 size={22} className="text-emerald-500" />
                <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">{title}</h2>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{copy}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Feature({ icon: Icon, title, copy }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
        <Icon size={24} />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{copy}</p>
    </div>
  );
}
