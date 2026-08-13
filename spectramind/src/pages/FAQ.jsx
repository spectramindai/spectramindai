import { HelpCircle, MessageCircleQuestion, ShieldQuestion } from "lucide-react";
import Footer from "../components/Footer";
import Navbar from "../components/layout/Navbar";

const faqs = [
  [
    "What does SpectraMind do?",
    "SpectraMind helps organizations manage compliance controls, evidence, risks, vendor reviews, and trust reporting in one place.",
  ],
  [
    "Can visitors access the full product?",
    "No. Public visitors can review product stories and testimonials, while the dashboard remains reserved for users with access.",
  ],
  [
    "Which frameworks can teams manage?",
    "The public pages currently highlight SOC 2, ISO 27001, and CMMC workflows.",
  ],
  [
    "Where does AI fit in?",
    "The AI assistant is designed to help teams answer questions about controls, evidence, policies, vendors, and risks faster.",
  ],
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              FAQs
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
              Answers for teams evaluating SpectraMind.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              A quick guide to what SpectraMind does, who can access the product,
              and how the platform supports compliance work.
            </p>
          </div>
        </section>

        <section className="px-6 py-20 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="rounded-lg bg-slate-950 p-7 text-white dark:bg-blue-600">
              <ShieldQuestion size={32} />
              <h2 className="mt-6 text-3xl font-bold">Still have questions?</h2>
              <p className="mt-3 leading-7 text-slate-300 dark:text-blue-100">
                Reach out if you need help understanding workflows, access, or framework coverage.
              </p>
            </div>

            <div className="grid gap-4">
              {faqs.map(([question, answer]) => (
                <article
                  key={question}
                  className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                      <HelpCircle size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                        {question}
                      </h2>
                      <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                        {answer}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-8 flex max-w-7xl items-center gap-3 rounded-lg bg-slate-50 p-5 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <MessageCircleQuestion size={22} className="text-blue-600 dark:text-blue-300" />
            <p>Use the Contact page for product, support, or business inquiries.</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
