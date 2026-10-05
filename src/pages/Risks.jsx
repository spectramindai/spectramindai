import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Save, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import AppShell from "../components/layout/AppShell";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";
import {
  IMPACT_VALUES,
  LIKELIHOOD_VALUES,
  RISK_LEVEL_VALUES,
  TREATMENT_STATUSES,
  canManageRisks,
  closeRisk,
  createRisk,
  saveRiskStore,
  updateRisk,
} from "../risks/RiskService";
import { isApiEnabled } from "../api/client";
import { createApiRisk, synchronizeRisks, updateApiRisk } from "../api/workflows";
import { resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

const severityStyles = {
  Critical: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  High: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Low: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const applicabilityStyles = {
  Applicable: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Not Applicable": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "Pending Assessment": "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const emptyRisk = {
  name: "",
  description: "",
  relatedFrameworks: "",
  relatedDomain: "",
  relatedControls: "",
  riskOwner: "",
  likelihood: "Medium",
  impact: "Medium",
  riskLevel: "Medium",
  treatmentStatus: "Open",
  reviewDate: "",
};

export default function Risks() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <RisksContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function RisksContent({ activeFramework }) {
  const location = useLocation();
  const navigate = useNavigate();
  const targetItemId = new URLSearchParams(location.search).get("item");
  const { user } = useUser();
  const { risks, risk: riskState } = useComplianceState();
  const riskStore = riskState?.store || { overrides: {}, customRisks: [] };
  const isManager = canManageRisks(user);
  const [showCreate, setShowCreate] = useState(false);
  const [newRisk, setNewRisk] = useState(emptyRisk);
  const [editingRiskId, setEditingRiskId] = useState("");
  const [draft, setDraft] = useState(emptyRisk);
  const [apiRisks, setApiRisks] = useState([]);
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(isApiEnabled);

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    synchronizeRisks(resolveFrameworkId(activeFramework.id) || activeFramework.id)
      .then((records) => { if (!cancelled) setApiRisks(records.map(fromApiRisk)); })
      .catch((error) => { if (!cancelled) setApiError(error.message || "Could not load risks"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFramework]);

  const sortedRisks = useMemo(
    () => [...(isApiEnabled ? apiRisks : risks || [])].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    [apiRisks, risks]
  );

  const persist = (nextStore) => saveRiskStore(activeFramework.id, nextStore);

  const startEdit = (risk) => {
    setEditingRiskId(risk.id);
    setDraft({
      riskName: risk.riskName,
      description: risk.description,
      relatedFrameworks: risk.relatedFrameworks,
      relatedDomain: risk.relatedDomain,
      relatedControls: risk.relatedControls,
      riskOwner: risk.riskOwner,
      likelihood: risk.likelihood,
      impact: risk.impact,
      riskLevel: risk.riskLevel,
      treatmentStatus: risk.treatmentStatus,
      reviewDate: risk.reviewDate,
    });
  };

  const saveEdit = async () => {
    if (isApiEnabled) {
      const current = apiRisks.find((risk) => risk.id === editingRiskId);
      try { const updated = await updateApiRisk(editingRiskId, current.apiVersion, riskInputForApi(draft)); setApiRisks((items) => items.map((risk) => risk.id === editingRiskId ? fromApiRisk(updated) : risk)); }
      catch (error) { setApiError(error.message || "Could not update risk"); return; }
      setEditingRiskId(""); return;
    }
    persist(updateRisk(riskStore, editingRiskId, draft));
    setEditingRiskId("");
  };

  const saveNewRisk = async () => {
    if (!newRisk.name.trim()) return;
    if (isApiEnabled) {
      try { const created = await createApiRisk({ frameworkId: resolveFrameworkId(activeFramework.id) || activeFramework.id, ...riskInputForApi(newRisk), name: newRisk.name.trim() }); setApiRisks((items) => [...items, fromApiRisk(created)]); }
      catch (error) { setApiError(error.message || "Could not create risk"); return; }
      setNewRisk(emptyRisk); setShowCreate(false); return;
    }
    persist(createRisk(riskStore, newRisk, activeFramework));
    setNewRisk(emptyRisk);
    setShowCreate(false);
  };
  const mitigateRisk = async (risk) => {
    if (!isApiEnabled) return persist(closeRisk(riskStore, risk.id));
    try { const updated = await updateApiRisk(risk.id, risk.apiVersion, { treatmentStatus: "MITIGATED" }); setApiRisks((items) => items.map((item) => item.id === risk.id ? fromApiRisk(updated) : item)); }
    catch (error) { setApiError(error.message || "Could not mitigate risk"); }
  };
  const openImplementationRecord = (itemId, itemType = "Control", riskId = "") => {
    const target = buildCrossModuleTarget({
      activeFramework,
      itemId,
      itemType,
      moduleContext: `Risk:${riskId}`,
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {apiError && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{apiError}</p>}
        {loading && <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">Loading risks...</p>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Risk
            </p>
            <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
              Risk Register
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
              Prioritize risks, assign owners, and track remediation work.
            </p>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Risk
            </button>
          )}
        </div>

        {isManager && showCreate && (
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <RiskForm
              title="Create risk"
              value={newRisk}
              onChange={setNewRisk}
              onCancel={() => setShowCreate(false)}
              onSave={saveNewRisk}
              saveLabel="Create"
            />
          </section>
        )}

        <div className="grid gap-4">
          {sortedRisks.map((risk) => {
            const isEditing = editingRiskId === risk.id;
            return (
              <article
                key={risk.id}
                className={`rounded-lg border bg-white p-6 shadow-sm dark:bg-slate-900 ${
                  targetItemId === risk.id
                    ? "border-blue-400 ring-2 ring-blue-100 dark:border-blue-500"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                      <AlertTriangle size={21} />
                    </div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-wider text-slate-400">
                        {risk.riskId}
                      </p>
                      <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                        {risk.riskName}
                      </h2>
                      <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                        {risk.description || "No description provided."}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Pill value={risk.applicabilityStatus} styles={applicabilityStyles} />
                    <Pill value={risk.riskLevel} styles={severityStyles} />
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-6">
                    <RiskForm
                      title="Edit risk"
                      value={draft}
                      onChange={setDraft}
                      onCancel={() => setEditingRiskId("")}
                      onSave={saveEdit}
                      saveLabel="Save"
                    />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid gap-3 md:grid-cols-4">
                      <Detail label="Related framework(s)" value={formatList(risk.relatedFrameworks)} />
                      <Detail label="Related domain" value={risk.relatedDomain} />
                      <RelatedControlDetail
                        controls={risk.relatedControls}
                        onOpen={(controlId) => openImplementationRecord(controlId, "Control", risk.id)}
                      />
                      <Detail label="Risk owner" value={risk.riskOwner} />
                      <Detail label="Likelihood" value={risk.likelihood} />
                      <Detail label="Impact" value={risk.impact} />
                      <Detail label="Treatment status" value={risk.treatmentStatus} />
                      <Detail label="Review date" value={risk.reviewDate || "No review date"} />
                    </div>

                    {isManager && (
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(risk)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => mitigateRisk(risk)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950"
                        >
                          <CheckCircle2 size={16} />
                          Close Risk
                        </button>
                      </div>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function fromApiRisk(risk) {
  const title = (value) => value ? `${value.charAt(0)}${value.slice(1).toLowerCase().replace("_", " ")}` : "";
  return { ...risk, apiVersion: risk.version, riskId: risk.sourceRiskId || risk.id, riskName: risk.name, title: risk.name, relatedFrameworks: [risk.frameworkId], relatedDomain: risk.domain || "General", riskOwner: risk.ownerName || "Unassigned", owner: risk.ownerName || "Unassigned", likelihood: title(risk.likelihood), impact: title(risk.impact), riskLevel: title(risk.level), severity: title(risk.level), treatmentStatus: title(risk.treatmentStatus), reviewDate: risk.reviewDate ? new Date(risk.reviewDate).toISOString().slice(0, 10) : "", applicabilityStatus: "Applicable", applicable: true, itemType: "Risk" };
}

function riskInputForApi(risk) {
  const enumValue = (value, fallback) => value ? String(value).toUpperCase().replace(/\s+/g, "_") : fallback;
  return { name: risk.riskName || risk.name, description: risk.description, domain: risk.relatedDomain, relatedControls: Array.isArray(risk.relatedControls) ? risk.relatedControls : String(risk.relatedControls || "").split(",").map((item) => item.trim()).filter(Boolean), ownerName: risk.riskOwner || undefined, likelihood: enumValue(risk.likelihood, "MEDIUM"), impact: enumValue(risk.impact, "MEDIUM"), level: enumValue(risk.riskLevel, "MEDIUM"), treatmentStatus: enumValue(risk.treatmentStatus, "OPEN"), reviewDate: risk.reviewDate ? new Date(`${risk.reviewDate}T00:00:00Z`).toISOString() : null };
}

function RiskForm({ title, value, onChange, onCancel, onSave, saveLabel }) {
  const setField = (field, nextValue) => onChange({ ...value, [field]: nextValue });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-950 dark:text-white">{title}</h3>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Risk name" value={value.riskName ?? value.name ?? ""} onChange={(nextValue) => setField(value.riskName !== undefined ? "riskName" : "name", nextValue)} />
        <Field label="Risk owner" value={value.riskOwner || ""} onChange={(nextValue) => setField("riskOwner", nextValue)} />
        <Field label="Related framework(s)" value={formatList(value.relatedFrameworks)} onChange={(nextValue) => setField("relatedFrameworks", nextValue)} />
        <Field label="Related domain" value={value.relatedDomain || ""} onChange={(nextValue) => setField("relatedDomain", nextValue)} />
        <Field label="Related control(s)" value={formatList(value.relatedControls)} onChange={(nextValue) => setField("relatedControls", nextValue)} />
        <SelectField label="Likelihood" value={value.likelihood} options={LIKELIHOOD_VALUES} onChange={(nextValue) => setField("likelihood", nextValue)} />
        <SelectField label="Impact" value={value.impact} options={IMPACT_VALUES} onChange={(nextValue) => setField("impact", nextValue)} />
        <SelectField label="Risk level" value={value.riskLevel} options={RISK_LEVEL_VALUES} onChange={(nextValue) => setField("riskLevel", nextValue)} />
        <SelectField label="Treatment status" value={value.treatmentStatus} options={TREATMENT_STATUSES} onChange={(nextValue) => setField("treatmentStatus", nextValue)} />
        <Field label="Review date" type="date" value={value.reviewDate || ""} onChange={(nextValue) => setField("reviewDate", nextValue)} />
      </div>

      <label className="block">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Description</span>
        <textarea
          value={value.description || ""}
          onChange={(event) => setField("description", event.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <Save size={16} />
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Pill({ value, styles }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ${styles[value] || styles.Medium || styles.Applicable}`}>
      {value}
    </span>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words font-bold text-slate-950 dark:text-white">{value || "Unassigned"}</p>
    </div>
  );
}

function RelatedControlDetail({ controls, onOpen }) {
  const values = Array.isArray(controls) ? controls : String(controls || "").split(",").map((item) => item.trim()).filter(Boolean);
  return (
    <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Related control(s)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length ? values.map((controlId) => (
          <button
            key={controlId}
            type="button"
            onClick={() => onOpen(controlId)}
            className="rounded bg-blue-50 px-2 py-1 text-xs font-black text-blue-700 transition hover:bg-blue-100"
          >
            {controlId}
          </button>
        )) : (
          <span className="font-bold text-slate-950 dark:text-white">Unassigned</span>
        )}
      </div>
    </div>
  );
}

function formatList(value) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  return value || "";
}
