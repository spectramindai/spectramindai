import {
  AlertTriangle,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppShell from "../../../components/layout/AppShell";
import CMMCModuleNavigation from "./CMMCModuleNavigation";
import { frameworkHasLibrary, useFrameworkWorkspace } from "../../../framework/FrameworkWorkspaceContext";
import { CMMC_CONTROL_STATUS_VALIDATION_EVENT, CMMC_PERSISTENCE_ERROR_EVENT } from "../hooks";
import { cmmcDomains } from "../data/cmmcDomains";
import { useCMMCWorkspaceFilters } from "./CMMCWorkspaceFilters";

const domainOptions = [["all", "All Domains"], ...cmmcDomains.map(({ shortCode, name }) => [shortCode, name])];

const statusOptions = ["All", "Not Started", "In Progress", "Completed", "Not Applicable"];

export default function CMMCImplementationLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [evidenceValidation, setEvidenceValidation] = useState(null);
  const [persistenceError, setPersistenceError] = useState(null);
  const frameworkWorkspace = useFrameworkWorkspace();
  const shouldShowWorkspaceFilters = !location.pathname.startsWith("/cmmc/operations/") && !["/cmmc", "/cmmc/uploaded-evidence", "/cmmc/overview", "/cmmc/scope", "/cmmc/gap-wizard"].includes(location.pathname);
  const {
    searchQuery,
    domainFilter,
    statusFilter,
    setSearchQuery,
    setDomainFilter,
    setStatusFilter,
    resetWorkspace,
  } = useCMMCWorkspaceFilters();

  useEffect(() => {
    const handleValidationFailure = (event) => {
      const detail = event.detail || {};
      setEvidenceValidation({
        controlId: String(detail.controlId || "").trim(),
        missingEvidence: Array.isArray(detail.missingEvidence) ? detail.missingEvidence : [],
        missingObjectives: Array.isArray(detail.missingObjectives) ? detail.missingObjectives : [],
        message: detail.message || "Upload all required evidence before marking this control as Implemented.",
      });
    };

    window.addEventListener(CMMC_CONTROL_STATUS_VALIDATION_EVENT, handleValidationFailure);
    return () => window.removeEventListener(CMMC_CONTROL_STATUS_VALIDATION_EVENT, handleValidationFailure);
  }, []);

  useEffect(() => {
    const handlePersistenceError = (event) => setPersistenceError(event.detail || { message: "Backend save failed." });
    window.addEventListener(CMMC_PERSISTENCE_ERROR_EVENT, handlePersistenceError);
    return () => window.removeEventListener(CMMC_PERSISTENCE_ERROR_EVENT, handlePersistenceError);
  }, []);

  return (
    <AppShell>
      <div className="space-y-4 text-slate-900">
          <header className="rounded-lg border border-white/75 bg-white/70 p-5 shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <Link
                  to="/cmmc"
                  className="flex min-w-0 items-center gap-4 rounded-lg transition hover:bg-white/50"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-amber-700/15 bg-white text-amber-700 shadow-sm">
                    <ShieldCheck size={23} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xl font-black tracking-normal text-slate-950">
                      CMMC Compliance Tracker
                    </span>
                    <span className="block text-xs font-semibold text-slate-500">
                      110 Controls · SPRS Scoring · Audit-Ready Documents
                    </span>
                  </span>
                </Link>

                <FrameworkSwitcher
                  activeSlug="cmmc"
                  frameworks={frameworkWorkspace.selectedFrameworks}
                  onSelect={(framework) => {
                    frameworkWorkspace.setActiveFramework(framework.id);
                    navigate(framework.slug === "cmmc" ? "/cmmc" : `/implementation?framework=${framework.slug}`);
                  }}
                />
              </div>

            </div>
          </header>

          <CMMCModuleNavigation />
          {shouldShowWorkspaceFilters && (
            <section className="rounded-lg border border-white/75 bg-[#fffdf8]/72 p-3 shadow-xl shadow-slate-900/5 backdrop-blur">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                  <label className="relative block w-full max-w-xs">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <span className="sr-only">Search CMMC workspace</span>
                    <input
                      type="search"
                      placeholder="Search controls, documents, notes..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white/80 pl-9 pr-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`h-9 rounded-lg border px-4 text-sm font-black transition ${
                          statusFilter === status
                            ? "border-blue-600/30 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-white/80 text-slate-600 hover:bg-white hover:text-blue-700"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  <select
                    value={domainFilter}
                    onChange={(event) => setDomainFilter(event.target.value)}
                    className="h-9 w-full max-w-xs rounded-lg border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-600 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                  >
                    {domainOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={resetWorkspace}
                  className="h-9 rounded-lg border border-red-200 bg-white px-4 text-sm font-bold text-red-500 transition hover:bg-red-50 hover:text-red-600"
                >
                  Reset
                </button>
              </div>
            </section>
          )}

          {evidenceValidation && (
            <EvidenceValidationBanner
              validation={evidenceValidation}
              onDismiss={() => setEvidenceValidation(null)}
            />
          )}

          {persistenceError && (
            <section role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 shadow-sm">
              <div className="flex gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
                <div>
                  <p className="font-black">{persistenceError.message || "Backend save failed."}</p>
                  <p className="mt-1 font-semibold text-rose-800">{persistenceError.reason || "Check the API connection and sign in again."}</p>
                </div>
              </div>
              <button type="button" onClick={() => setPersistenceError(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-rose-500 hover:bg-rose-100" aria-label="Dismiss persistence error"><X size={16} /></button>
            </section>
          )}

        {children}
      </div>
    </AppShell>
  );
}

function EvidenceValidationBanner({ validation, onDismiss }) {
  const evidencePath = `/cmmc/ssp?controlId=${encodeURIComponent(validation.controlId)}`;
  const missingEvidence = validation.missingEvidence.length
    ? validation.missingEvidence
    : ["Required evidence for this control"];
  const missingObjectives = validation.missingObjectives || [];

  return (
    <section role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <p className="font-black">This control cannot be marked as Implemented.</p>
            <p className="mt-1 font-semibold text-rose-800">
              {validation.message || "Please upload the required evidence before changing the control status."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-rose-500 transition hover:bg-rose-100"
          aria-label="Dismiss evidence validation message"
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 rounded-md border border-rose-100 bg-white/70 px-3 py-2">
        {missingObjectives.length ? (
          <>
            <p className="text-xs font-black uppercase tracking-wide text-rose-500">Missing Assessment Objectives</p>
            <ul className="mt-2 space-y-1">
              {missingObjectives.map((objective) => (
                <li key={objective.id} className="font-semibold text-rose-900">
                  {objective.identifier ? `${objective.identifier} ` : ""}{objective.text}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="text-xs font-black uppercase tracking-wide text-rose-500">Missing Evidence</p>
        <ul className="mt-2 space-y-1">
          {missingEvidence.map((item, index) => (
            <li key={`${item}-${index}`}>
              <Link to={evidencePath} className="font-semibold text-rose-800 underline-offset-2 hover:underline">
                {item}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Link
        to={evidencePath}
        className="mt-3 inline-flex min-h-8 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-black text-white transition hover:bg-rose-700"
      >
        Open Evidence
      </Link>
    </section>
  );
}

function FrameworkSwitcher({ activeSlug, frameworks = [], onSelect }) {
  const implementationFrameworks = frameworks.filter((framework) => framework.slug === "cmmc" || frameworkHasLibrary(framework.id));

  return (
    <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-lg border border-slate-200/80 bg-white/75 p-1 shadow-sm lg:flex-nowrap lg:justify-end">
      {implementationFrameworks.map((framework) => {
        const isActive = framework.slug === activeSlug;

        return (
          <button
            key={framework.id}
            type="button"
            onClick={() => onSelect(framework)}
            className={`inline-flex h-9 min-w-[88px] items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-black transition ${
              isActive
                ? "bg-amber-700 text-white shadow-sm shadow-amber-700/20"
                : "text-slate-600 hover:bg-white hover:text-slate-950"
            }`}
            aria-pressed={isActive}
          >
            {framework.shortName || framework.name}
          </button>
        );
      })}
    </div>
  );
}
