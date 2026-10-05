import { useState, useEffect } from "react";
import { Building2, Plus, X } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { readScopedJson, writeScopedJson } from "../auth/session";
import { isApiEnabled } from "../api/client";
import { createVendor, listVendors } from "../api/assurance";

const initialVendors = [
  { id: 1, name: "AWS", category: "Cloud Provider", risk: "Low", reviewDate: "July 2026" },
  { id: 2, name: "GitHub", category: "Source Control", risk: "Medium", reviewDate: "August 2026" },
  { id: 3, name: "Slack", category: "Communication", risk: "Low", reviewDate: "September 2026" },
  { id: 4, name: "Google Workspace", category: "Identity & Email", risk: "Medium", reviewDate: "October 2026" },
];

const riskStyles = {
  Low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  High: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export default function Vendors() {
  const [vendors, setVendors] = useState(() => {
    try {
      return readScopedJson("spectramind:vendors", initialVendors);
    } catch {
      return initialVendors;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [risk, setRisk] = useState("Low");
  const [reviewDate, setReviewDate] = useState("");
  const [loading, setLoading] = useState(isApiEnabled);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isApiEnabled) writeScopedJson("spectramind:vendors", vendors);
  }, [vendors]);

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    listVendors()
      .then((records) => {
        if (!cancelled) setVendors(records.map(fromApiVendor));
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load vendors");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const newVendor = isApiEnabled
        ? fromApiVendor(await createVendor({ name: name.trim(), category: category.trim() || "Uncategorized", risk: risk.toUpperCase(), nextReviewDate: reviewDate ? new Date(`${reviewDate}T00:00:00`).toISOString() : null }))
        : { id: Date.now(), name: name.trim(), category: category.trim() || "Uncategorized", risk, reviewDate: reviewDate || "None set" };
      setVendors((current) => [newVendor, ...current]);
      setName(""); setCategory(""); setRisk("Low"); setReviewDate(""); setIsModalOpen(false);
    } catch (requestError) {
      setError(requestError.message || "Could not save vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Third parties
            </p>
            <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
              Vendor Management
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
              Keep vendor ownership, renewal dates, and risk posture easy to review.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus size={18} />
            Add Vendor
          </button>
        </div>

        {error && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{error}</p>}
        {loading && <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-500">Loading vendors...</p>}

        {!loading && <div className="grid gap-4 md:grid-cols-2">
          {vendors.map((vendor) => (
            <article
              key={vendor.id}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                    <Building2 size={21} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                      {vendor.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {vendor.category}
                    </p>
                  </div>
                </div>

                <span className={`rounded-full px-3 py-1 text-sm font-bold ${riskStyles[vendor.risk] || riskStyles.Low}`}>
                  {vendor.risk} Risk
                </span>
              </div>

              <div className="mt-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Next review
                </p>
                <p className="mt-1 font-bold text-slate-950 dark:text-white">
                  {vendor.reviewDate}
                </p>
              </div>
            </article>
          ))}
        </div>}
      </div>

      {isModalOpen && (
        <div onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">Add New Vendor</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Vendor Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  placeholder="AWS, Github, Vercel..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Category
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  placeholder="Cloud Provider, CRM, Sources Control..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Risk Level
                </label>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="Low">Low Risk</option>
                  <option value="Medium">Medium Risk</option>
                  <option value="High">High Risk</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Next Review Date
                </label>
                <input
                  type="text"
                  value={reviewDate}
                  onChange={(e) => setReviewDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  {saving ? "Saving..." : "Save Vendor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function fromApiVendor(vendor) {
  return {
    ...vendor,
    risk: `${String(vendor.risk || "LOW").charAt(0)}${String(vendor.risk || "LOW").slice(1).toLowerCase()}`,
    reviewDate: vendor.nextReviewDate ? new Date(vendor.nextReviewDate).toLocaleDateString() : "None set",
  };
}
