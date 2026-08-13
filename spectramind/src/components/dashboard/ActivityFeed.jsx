import { CheckCircle2 } from "lucide-react";
import { useComplianceState } from "../../compliance/ComplianceStateContext";
import { CMMC_FRAMEWORK_ID, resolveFrameworkId } from "../../core/engines/framework-engine/frameworkRegistry";
import { useCMMCActivityHistory } from "../../features/cmmc/hooks";
import { formatCMMCActivityName } from "../../features/cmmc/services";
import { useFrameworkWorkspace } from "../../framework/FrameworkWorkspaceContext";

export default function ActivityFeed({ activities: suppliedActivities }) {
  const { audit } = useComplianceState();
  const { activeFramework } = useFrameworkWorkspace();
  const cmmcActivities = useCMMCActivityHistory();
  const isCMMCWorkspace = resolveFrameworkId(activeFramework?.id) === CMMC_FRAMEWORK_ID;
  const activities = suppliedActivities || (isCMMCWorkspace
    ? cmmcActivities.slice(0, 5).map((activity) => ({
        id: activity.id,
        name: formatCMMCActivityName(activity),
        timestamp: activity.timestamp,
      }))
    : (audit.timeline || []).slice(0, 5));

  return (
    <div className="h-full rounded-lg border border-white/75 bg-white/62 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
      <h2 className="text-xl font-black text-slate-900">
        Recent Activity
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Latest changes across your compliance workspace
      </p>

      <div className="mt-6 space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={17} />
            </div>
            <div className="min-w-0 flex-1 border-b border-slate-100 pb-4 last:border-b-0">
              <p className="font-bold text-slate-900">{activity.name}</p>
              <p className="mt-1 text-sm text-slate-500">{formatDate(activity.timestamp)}</p>
            </div>
          </div>
        ))}
        {!activities.length && (
          <p className="text-sm font-semibold text-slate-500">No recent audit activity yet.</p>
        )}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
