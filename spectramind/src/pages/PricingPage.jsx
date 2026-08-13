import { ArrowRight, Building2, CheckCircle2, Rocket, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const plans = [
  {
    icon: Rocket,
    name: "Launch",
    description: "For early teams organizing their first compliance program.",
    features: ["Core controls", "Evidence repository", "Risk register"],
  },
  {
    icon: ShieldCheck,
    name: "Scale",
    description: "For growing teams managing audits, vendors, and trust requests.",
    features: ["Framework mapping", "Vendor reviews", "Trust center"],
  },
  {
    icon: Building2,
    name: "Enterprise",
    description: "For mature programs with deeper assurance and workflow needs.",
    features: ["Custom workflows", "Advanced reporting", "Priority support"],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 text-center dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Pricing
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
              Pricing tailored to your compliance stage.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Choose a starting point for your program, then work with our team
              to fit SpectraMind to your frameworks, workflows, and company size.
            </p>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;

              return (
                <article
                  key={plan.name}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Icon size={24} />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold text-slate-950 dark:text-white">
                    {plan.name}
                  </h2>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    {plan.description}
                  </p>
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-7xl rounded-lg bg-slate-950 p-8 text-white dark:bg-blue-600">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-3xl font-bold">Need a custom compliance package?</h2>
                <p className="mt-3 max-w-2xl text-slate-300 dark:text-blue-100">
                  Tell us your frameworks, team size, and audit timeline. We will help shape the right plan.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Contact Us
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
