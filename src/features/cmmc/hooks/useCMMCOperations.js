import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, isApiEnabled } from "../../../api/client";
import { canManageWorkspace, readScopedJson, writeScopedJson } from "../../../auth/session";
import { useUser } from "../../../auth/UserContext";
import { operationModules, validateOperation } from "../data/operations";

const KEY = "compvd:cmmc-operations";
const EVENT = "compvd:cmmc-operations-updated";

export function useCMMCOperations() {
  const { user } = useUser();
  const scope = user?.organizationId || "";
  const scopeRef = useRef(scope);
  const requestSequence = useRef(0);
  scopeRef.current = scope;
  const [data, setData] = useState({ scope: "", records: [], loading: true, error: "" });
  const [saving, setSaving] = useState(false);
  const canEdit = Boolean(scope && canManageWorkspace(user?.role));
  const refresh = useCallback(async () => {
    if (!scope) return;
    const sequence = ++requestSequence.current;
    try {
      const records = isApiEnabled ? await apiRequest("/api/v1/cmmc/operations") : readScopedJson(KEY, []);
      if (scopeRef.current === scope && sequence === requestSequence.current) setData({ scope, records: records.filter(record => Object.hasOwn(operationModules, record.module)), loading: false, error: "" });
    } catch (error) { if (scopeRef.current === scope && sequence === requestSequence.current) setData(current => ({ ...current, scope, loading: false, error: error.message })); }
  }, [scope]);
  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const timer = isApiEnabled ? window.setInterval(refresh, 30000) : null;
    return () => { window.removeEventListener(EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); if (timer) window.clearInterval(timer); };
  }, [refresh]);
  const save = async draft => {
    if (!canEdit) throw new Error("Only workspace managers can edit these records.");
    const validation = validateOperation(draft);
    if (validation) throw new Error(validation);
    const { id = crypto.randomUUID(), version = 0 } = draft;
    const record = Object.fromEntries(["module", "title", "owner", "status", "dueDate", "controlIds", "relatedIds", "evidenceIds", "details", "archived"].map(key => [key, draft[key]]));
    setSaving(true);
    ++requestSequence.current;
    try {
      let saved;
      if (isApiEnabled) saved = await apiRequest(`/api/v1/cmmc/operations/${id}`, { method: "PUT", body: JSON.stringify({ record, version }) });
      else {
        const records = readScopedJson(KEY, []);
        const current = records.find(item => item.id === id);
        if ((current?.version || 0) !== version) throw new Error("This record changed. Reload it before saving.");
        const now = new Date().toISOString();
        saved = { ...record, id, version: version + 1, createdAt: current?.createdAt || now, updatedAt: now, history: [...(current?.history || []), { at: now, actor: user.email, revision: version + 1, record }] };
        writeScopedJson(KEY, [...records.filter(item => item.id !== id), saved]);
      }
      if (scopeRef.current === scope) {
        ++requestSequence.current;
        setData(current => ({ ...current, scope, records: [...current.records.filter(item => item.id !== id), saved], error: "" }));
        window.dispatchEvent(new Event(EVENT));
      }
      return saved;
    } finally { setSaving(false); }
  };
  return { records: data.scope === scope ? data.records : [], loading: data.scope !== scope || data.loading, error: data.scope === scope ? data.error : "", saving, save, refresh, canEdit };
}
