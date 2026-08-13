import { useState } from "react";
import type { Evidence } from "../models";

export interface EvidenceMappingPanelProps {
  evidence?: Evidence | null;
  onMapControls?: (evidenceId: string, controlIds: string[]) => void;
}

/** Displays and edits mappings from one evidence record to many controls. */
export function EvidenceMappingPanel({ evidence, onMapControls }: EvidenceMappingPanelProps) {
  const [controlIds, setControlIds] = useState("");
  if (!evidence) return null;

  const mappedControls = Array.from(new Set(evidence.mappings.map((mapping) => mapping.controlId)));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-950">Evidence Mapping</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {mappedControls.length ? (
          mappedControls.map((controlId) => (
            <span key={controlId} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {controlId}
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-500">No controls mapped yet.</p>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
          placeholder="Control IDs, comma separated"
          value={controlIds}
          onChange={(event) => setControlIds(event.target.value)}
        />
        <button
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={() => {
            const ids = controlIds.split(",").map((item) => item.trim()).filter(Boolean);
            if (ids.length) onMapControls?.(evidence.id, ids);
            setControlIds("");
          }}
        >
          Map
        </button>
      </div>
    </section>
  );
}

