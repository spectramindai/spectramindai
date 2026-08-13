import { ArrowRight, BriefcaseBusiness, LifeBuoy, Mail } from "lucide-react";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const contacts = [
  {
    icon: Mail,
    title: "Email",
    copy: "contact@spectramind.ai",
  },
  {
    icon: LifeBuoy,
    title: "Support",
    copy: "Product questions, compliance guidance, and technical support.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Business Inquiries",
    copy: "Partnerships, pricing conversations, and implementation planning.",
  },
];

export default function Contact() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                Contact
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
                Let&apos;s talk about your compliance workflow.
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Tell us what frameworks you manage, where evidence gets stuck,
                and what your team needs before the next audit or customer review.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                What we can help with
              </h2>
              <div className="mt-5 space-y-3 text-slate-600 dark:text-slate-300">
                <p>Framework planning and audit readiness</p>
                <p>Evidence workflows and vendor reviews</p>
                <p>Pricing, implementation, and product access</p>
              </div>
              <a
                href="mailto:contact@spectramind.ai"
                className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Email Us
                <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {contacts.map((contact) => {
              const Icon = contact.icon;

              return (
                <article
                  key={contact.title}
                  className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Icon size={24} />
                  </div>
                  <h2 className="mt-6 text-2xl font-bold text-slate-950 dark:text-white">
                    {contact.title}
                  </h2>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    {contact.copy}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
