import { hasApiConfigurationError } from "../api/client";

export default function ApiConfigurationGuard({ children }) {
  if (!hasApiConfigurationError) return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-8 shadow-xl">
        <p className="text-sm font-black uppercase tracking-widest text-rose-600">Configuration required</p>
        <h1 className="mt-3 text-3xl font-black text-slate-950">Backend API is not configured</h1>
        <p className="mt-4 leading-7 text-slate-600">
          This production build cannot safely use browser storage as its database. Set
          <code className="mx-1 rounded bg-slate-100 px-2 py-1 font-mono text-sm">VITE_API_URL</code>
          to the Azure App Service URL and redeploy the frontend.
        </p>
      </section>
    </main>
  );
}
