import {
  ArrowRight,
  CalendarCheck,
  Mail,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

const contactRoutes = [
  {
    icon: CalendarCheck,
    title: "Book a demo",
    copy: "Walk through audit readiness, evidence workflows, vendor reviews, and trust reporting.",
    action: "Schedule time",
    to: "/contact",
  },
  {
    icon: MessageCircle,
    title: "Talk to sales",
    copy: "Get packaging guidance for your stage, frameworks, and customer assurance needs.",
    action: "Contact sales",
    to: "/contact",
  },
  {
    icon: ShieldCheck,
    title: "Partner with us",
    copy: "Bring auditors, advisors, brokers, and implementation teams into the same trust workspace.",
    action: "Partner inquiry",
    to: "/contact",
  },
];

export default function ContactSection() {
  return (
    <section id="contact" className="px-6 pb-12 pt-24 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-lg border border-white/80 bg-white/58 shadow-2xl shadow-slate-900/10 backdrop-blur">
        <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative overflow-hidden border-b border-white/70 p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(216,180,109,.28),transparent_18rem),radial-gradient(circle_at_82%_26%,rgba(255,255,255,.9),transparent_16rem)]" />
            <div className="relative">
              <p className="text-sm font-black uppercase tracking-widest text-blue-700">
                Contact us
              </p>
              <h2 className="mt-4 text-4xl font-black leading-tight text-slate-900 md:text-5xl">
                Ready to turn compliance into a calm operating rhythm?
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Tell us what you are preparing for. We will help map the right
                workspace for controls, evidence, risk, vendors, and customer
                trust.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {["SOC 2", "ISO 27001", "Vendor risk"].map((item) => (
                  <div
                    key={item}
                    className="rounded-lg border border-white/75 bg-white/58 px-4 py-3 text-sm font-bold text-slate-700 shadow-lg shadow-slate-900/5"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-8 lg:p-10">
            <form
              className="grid gap-4 rounded-lg border border-slate-200 bg-[#fffdf8]/74 p-5"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Work email
                  <input
                    type="email"
                    required
                    placeholder="you@company.com"
                    className="min-h-12 rounded-lg border border-slate-300 bg-white/80 px-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Priority
                  <select className="min-h-12 rounded-lg border border-slate-300 bg-white/80 px-4 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100">
                    <option>Audit readiness</option>
                    <option>Vendor risk</option>
                    <option>Trust center</option>
                    <option>Questionnaires</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                What should we help with?
                <textarea
                  rows={4}
                  placeholder="Tell us about your frameworks, timelines, or customer trust workflow."
                  className="rounded-lg border border-slate-300 bg-white/80 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-5 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5"
                >
                  Send request
                  <ArrowRight size={18} />
                </button>
                <Link
                  to="/contact"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-blue-600/25 bg-white/70 px-5 font-bold text-slate-800 transition hover:-translate-y-0.5 hover:bg-white hover:text-blue-700"
                >
                  <Mail size={18} />
                  Contact page
                </Link>
              </div>
            </form>

            <div className="grid gap-3 md:grid-cols-3">
              {contactRoutes.map((route) => {
                const Icon = route.icon;

                return (
                  <Link
                    key={route.title}
                    to={route.to}
                    className="group rounded-lg border border-white/75 bg-white/55 p-4 shadow-lg shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-blue-600/25 hover:bg-white/80"
                  >
                    <Icon size={20} className="text-blue-700" />
                    <h3 className="mt-3 font-black text-slate-900">
                      {route.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {route.copy}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-blue-700">
                      {route.action}
                      <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
