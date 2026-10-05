import { Link } from "react-router-dom";
import AppShell from "../components/layout/AppShell";

export default function ActiveFrameworkRequired() {
  return (
    <AppShell>
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Please select a framework first.
        </h1>
        <Link
          to="/frameworks"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Go to Frameworks
        </Link>
      </div>
    </AppShell>
  );
}
