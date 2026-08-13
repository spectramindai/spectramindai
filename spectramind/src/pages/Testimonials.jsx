import { Quote, Star } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/Footer";

const placeholders = [
  "Security leader testimonial",
  "Compliance manager testimonial",
  "Founder testimonial",
];

export default function Testimonials() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <Navbar />

      <main>
        <section className="border-b border-slate-200 bg-slate-50 px-6 py-24 dark:border-slate-800 dark:bg-slate-900 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Product Stories
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-bold leading-tight text-slate-950 dark:text-white md:text-6xl">
              See how teams use SpectraMind before requesting access.
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              This page is reserved for customer testimonials, product stories,
              and proof points that help visitors understand the app without
              entering the private dashboard.
            </p>
          </div>
        </section>

        <section className="px-6 py-20 dark:bg-slate-950 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 md:grid-cols-3">
              {placeholders.map((title) => (
                <article
                  key={title}
                  className="rounded-lg border border-dashed border-slate-300 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
                >
                  <Quote size={26} className="text-blue-600 dark:text-blue-300" />

                  <div className="mt-6 flex gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <Star key={item} size={18} fill="currentColor" />
                    ))}
                  </div>

                  <h2 className="mt-6 text-xl font-bold text-slate-950 dark:text-white">
                    {title}
                  </h2>

                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    Add a customer quote, role, company, compliance outcome,
                    and measurable result here.
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                Future testimonial gallery
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">
                Use this area for video testimonials, logos, case studies, or
                short review snippets once the content is ready.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
