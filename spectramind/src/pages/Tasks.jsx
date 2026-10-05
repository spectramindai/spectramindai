import { CalendarDays, CheckCircle2, CircleDot, ExternalLink, ListChecks, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { readScopedJson } from "../auth/session";
import { useUser } from "../auth/UserContext";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { TASK_STATUSES } from "../tasks/TaskService";
import { canManageTraining } from "../training/TrainingService";
import { isApiEnabled } from "../api/client";
import { listEmployees } from "../api/people";
import { synchronizeTasks, updateApiTask } from "../api/workflows";
import { resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";

const filters = ["All", ...TASK_STATUSES, "Overdue"];

export default function Tasks() {
  const { activeFramework } = useFrameworkWorkspace();
  if (!activeFramework) return <ActiveFrameworkRequired />;
  return <TasksContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function TasksContent({ activeFramework }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const canManage = canManageTraining(user);
  const { tasks, actions } = useComplianceState();
  const [apiTasks, setApiTasks] = useState([]);
  const [apiEmployees, setApiEmployees] = useState([]);
  const [loading, setLoading] = useState(isApiEnabled);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const employees = isApiEnabled ? apiEmployees : readScopedJson("spectramind:employees", []);
  const sourceTasks = isApiEnabled ? apiTasks : tasks;

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    const frameworkId = resolveFrameworkId(activeFramework.id) || activeFramework.id;
    Promise.all([synchronizeTasks(frameworkId), listEmployees()])
      .then(([taskRecords, employeeRecords]) => {
        if (!cancelled) { setApiTasks(taskRecords.map(fromApiTask)); setApiEmployees(employeeRecords); setError(""); }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || "Could not load tasks"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFramework, refreshVersion]);

  const taskMetrics = useMemo(() => {
    const completed = sourceTasks.filter((task) => task.status === "Completed").length;
    const inProgress = sourceTasks.filter((task) => task.status === "In Progress").length;
    const overdue = sourceTasks.filter(isOverdue).length;
    return { total: sourceTasks.length, open: sourceTasks.length - completed, completed, inProgress, overdue };
  }, [sourceTasks]);

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sourceTasks
      .filter((task) => statusFilter === "All" || (statusFilter === "Overdue" ? isOverdue(task) : task.status === statusFilter))
      .filter((task) => !normalized || [task.title, task.description, task.itemId, task.category, task.owner].join(" ").toLowerCase().includes(normalized))
      .sort((left, right) => taskSortValue(left) - taskSortValue(right));
  }, [query, sourceTasks, statusFilter]);

  const owners = ["Unassigned", ...new Set(employees.map((employee) => employee.name).filter(Boolean))];
  const replaceTask = (updated) => setApiTasks((current) => current.map((task) => task.id === updated.id ? fromApiTask(updated) : task));
  const updateTask = async (task, updates) => {
    if (!canManage) return;
    if (!isApiEnabled) {
      if (updates.status === "Completed") actions.completeTask(task);
      else actions.updateTask(task.id, updates);
      return;
    }
    const apiUpdates = {
      ...(updates.owner !== undefined ? { ownerName: updates.owner } : {}),
      ...(updates.status !== undefined ? { status: statusToApi(updates.status) } : {}),
      ...(updates.dueDate !== undefined ? { dueDate: updates.dueDate ? new Date(`${updates.dueDate}T00:00:00Z`).toISOString() : null } : {}),
    };
    try { replaceTask(await updateApiTask(task.id, task.apiVersion, apiUpdates)); }
    catch (requestError) { setError(requestError.message || "Could not update task"); }
  };
  const openLinkedItem = (task) => {
    if (!task.itemId) return;
    const target = buildCrossModuleTarget({ activeFramework, itemId: task.itemId, itemType: task.itemType || task.category, moduleContext: `Task:${task.id}`, mode: "resolve" });
    navigate(target.path, { state: target.state });
  };

  return <AppShell><div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-black uppercase tracking-widest text-amber-700">Work management</p><h1 className="mt-2 text-4xl font-black text-slate-950">Tasks</h1><p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">Actionable work generated from {activeFramework.name} controls, evidence gaps, risks, and audit findings.</p></div><button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16}/>Refresh</button></header>
    {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Open work" value={taskMetrics.open} icon={ListChecks}/><Metric label="In progress" value={taskMetrics.inProgress} icon={CircleDot}/><Metric label="Overdue" value={taskMetrics.overdue} icon={CalendarDays} warning/><Metric label="Completed" value={taskMetrics.completed} icon={CheckCircle2}/></section>
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center"><label className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, linked records, owners..." className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-blue-500"/></label><div className="flex flex-wrap gap-2">{filters.map((filter) => <button type="button" key={filter} onClick={() => setStatusFilter(filter)} className={`rounded-lg px-3 py-2 text-xs font-black transition ${statusFilter === filter ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{filter}</button>)}</div></div>
      <div className="divide-y divide-slate-100">{visibleTasks.map((task) => <article key={task.id} className="grid gap-4 p-5 transition hover:bg-slate-50/50 xl:grid-cols-[minmax(0,1fr)_170px_150px_170px_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${priorityStyle(task.priority)}`}>{task.priority || "Normal"}</span><span className="text-xs font-bold text-slate-400">{task.category || "Compliance"}{task.itemId ? ` · ${task.itemId}` : ""}</span></div><h2 className="mt-2 font-black text-slate-950">{task.title}</h2><p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">{task.description || "Complete the linked compliance action."}</p></div><label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Owner<select disabled={!canManage} value={task.owner || "Unassigned"} onChange={(event) => updateTask(task,{owner:event.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-50">{owners.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Due date<input disabled={!canManage} type="date" value={dateInput(task.dueDate)} onChange={(event) => updateTask(task,{dueDate:event.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-50"/></label><label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status<select disabled={!canManage} value={task.status} onChange={(event) => updateTask(task,{status:event.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-50">{TASK_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><div className="flex gap-2 xl:justify-end">{task.itemId ? <button type="button" onClick={() => openLinkedItem(task)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white hover:text-blue-700" title="Open linked record"><ExternalLink size={16}/></button> : null}{canManage && task.status !== "Completed" ? <button type="button" onClick={() => updateTask(task,{status:"Completed"})} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"><CheckCircle2 size={15}/>Complete</button> : null}</div></article>)}{!visibleTasks.length ? <div className="px-6 py-14 text-center"><CheckCircle2 size={32} className="mx-auto text-slate-300"/><h2 className="mt-3 font-black text-slate-800">No matching tasks</h2><p className="mt-1 text-sm font-semibold text-slate-500">Try another status or search term.</p></div> : null}</div>
    </section>{loading ? <p className="text-center text-sm font-bold text-slate-400">Loading tasks…</p> : null}
  </div></AppShell>;
}

function Metric({ label, value, icon: Icon, warning }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className={`grid h-10 w-10 place-items-center rounded-xl ${warning ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}><Icon size={19}/></span><span className="text-3xl font-black text-slate-950">{value}</span></div><p className="mt-4 text-xs font-black uppercase tracking-wider text-slate-500">{label}</p></div>; }
function fromApiTask(task) { return { ...task, apiVersion: task.version, status: { OPEN: "Open", IN_PROGRESS: "In Progress", COMPLETED: "Completed" }[task.status] || task.status, owner: task.ownerName || "Unassigned", itemId: task.itemId || task.sourceTemplateId || task.id, description: task.description || "", dueDate: task.dueDate || "" }; }
function statusToApi(status) { return { Open: "OPEN", "In Progress": "IN_PROGRESS", Completed: "COMPLETED" }[status] || status; }
function isOverdue(task) { if (!task.dueDate || task.status === "Completed") return false; const due = new Date(task.dueDate); due.setHours(23,59,59,999); return due.getTime() < Date.now(); }
function taskSortValue(task) { if (task.status === "Completed") return 4; if (isOverdue(task)) return 0; return { High: 1, Medium: 2, Low: 3 }[task.priority] || 2; }
function priorityStyle(priority) { return { High: "bg-rose-50 text-rose-700", Medium: "bg-amber-50 text-amber-700", Low: "bg-emerald-50 text-emerald-700" }[priority] || "bg-slate-100 text-slate-600"; }
function dateInput(value) { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value).slice(0,10) : date.toISOString().slice(0,10); }
