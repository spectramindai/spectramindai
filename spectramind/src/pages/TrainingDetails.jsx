import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, Clock3, Edit3, Save, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { assignTraining, completeTraining, listEmployees, synchronizeTraining, updateTrainingCourse } from "../api/people";
import { isApiEnabled } from "../api/client";
import { useUser } from "../auth/UserContext";
import { readScopedJson } from "../auth/session";
import AppShell from "../components/layout/AppShell";
import {
  canManageTraining,
  loadTrainingAssignments,
  loadTrainingCompletions,
  loadTrainingLibrary,
  saveTrainingAssignments,
  saveTrainingCompletions,
  saveTrainingLibrary,
} from "../training/TrainingService";

export default function TrainingDetails() {
  const { trainingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const canManage = canManageTraining(user);
  const returnTo = typeof location.state?.returnTo === "string" ? location.state.returnTo : "/training";
  const [library, setLibrary] = useState(() => loadTrainingLibrary());
  const [employees, setEmployees] = useState(() => readScopedJson("spectramind:employees", []));
  const [assignments, setAssignments] = useState(() => loadTrainingAssignments(readScopedJson("spectramind:employees", []), loadTrainingLibrary()));
  const [completions, setCompletions] = useState(() => loadTrainingCompletions());
  const [assignmentIds, setAssignmentIds] = useState({});
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const training = library.find((course) => String(course.id) === String(trainingId));
  const [draft, setDraft] = useState(() => createTrainingDraft(training));

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    Promise.all([listEmployees(), synchronizeTraining()])
      .then(([employeeRecords, courses]) => {
        if (cancelled) return;
        const localById = new Map(loadTrainingLibrary().map((course) => [course.id, course]));
        const mappedLibrary = courses.map((course) => ({
          ...course,
          dueDate: course.dueDate ? new Date(course.dueDate).toISOString().slice(0, 10) : "",
          relatedFrameworks: course.relatedFrameworks || [],
          documentContent: localById.get(course.id)?.documentContent || "",
          learningObjectives: localById.get(course.id)?.learningObjectives || [],
        }));
        const mappedEmployees = employeeRecords.map((employee) => ({ ...employee, role: employee.jobRole || "User" }));
        const nextAssignments = Object.fromEntries(courses.map((course) => [course.id, course.assignments.map((assignment) => assignment.employeeId)]));
        const nextCompletions = Object.fromEntries(courses.map((course) => [course.id, Object.fromEntries(course.assignments.filter((assignment) => assignment.status === "COMPLETED").map((assignment) => [assignment.employeeId, { completedAt: assignment.completedAt }]))]));
        setLibrary(mappedLibrary);
        setEmployees(mappedEmployees);
        setAssignments(nextAssignments);
        setCompletions(nextCompletions);
        setAssignmentIds(Object.fromEntries(courses.flatMap((course) => course.assignments.map((assignment) => [`${course.id}:${assignment.employeeId}`, assignment.id]))));
        const current = mappedLibrary.find((course) => String(course.id) === String(trainingId));
        setDraft(createTrainingDraft(current));
        saveTrainingLibrary(mappedLibrary);
      })
      .catch((requestError) => setError(requestError.message || "Could not load training details"));
    return () => { cancelled = true; };
  }, [trainingId]);

  const currentEmployee = useMemo(() => findCurrentEmployee(employees, user), [employees, user]);
  const assignedIds = assignments[trainingId] || [];
  const completedByEmployee = completions[trainingId] || {};
  const isAssignedToCurrentUser = Boolean(currentEmployee && assignedIds.includes(currentEmployee.id));
  const isCurrentUserComplete = Boolean(currentEmployee && completedByEmployee[currentEmployee.id]);
  const completionPercent = assignedIds.length ? Math.round((assignedIds.filter((id) => completedByEmployee[id]).length / assignedIds.length) * 100) : 0;

  const saveDocument = async () => {
    if (!canManage || !training) return;
    const objectives = draft.objectivesText.split("\n").map((line) => line.trim()).filter(Boolean);
    const updates = { name: draft.name.trim(), description: draft.description.trim(), dueDate: draft.dueDate, documentContent: draft.documentContent.trim(), learningObjectives: objectives };
    const nextLibrary = library.map((course) => course.id === training.id ? { ...course, ...updates } : course);
    setLibrary(nextLibrary);
    saveTrainingLibrary(nextLibrary);
    if (isApiEnabled) {
      try {
        await updateTrainingCourse(training.id, {
          name: updates.name,
          description: updates.description,
          dueDate: updates.dueDate ? new Date(`${updates.dueDate}T00:00:00Z`).toISOString() : null,
        });
      } catch (requestError) {
        setError(requestError.message || "Could not save training");
        return;
      }
    }
    setEditing(false);
  };

  const toggleAssignment = async (employeeId) => {
    if (!canManage || !training) return;
    const wasAssigned = assignedIds.includes(employeeId);
    const nextIds = wasAssigned ? assignedIds.filter((id) => id !== employeeId) : [...assignedIds, employeeId];
    if (isApiEnabled) {
      try { await assignTraining(training.id, nextIds); }
      catch (requestError) { setError(requestError.message || "Could not update assignment"); return; }
    }
    const nextAssignments = { ...assignments, [training.id]: nextIds };
    setAssignments(nextAssignments);
    if (wasAssigned) {
      const nextCourseCompletions = Object.fromEntries(
        Object.entries(completedByEmployee).filter(([id]) => String(id) !== String(employeeId))
      );
      const nextCompletions = { ...completions, [training.id]: nextCourseCompletions };
      setCompletions(nextCompletions);
      if (!isApiEnabled) saveTrainingCompletions(nextCompletions, employees, library, nextAssignments);
    }
    if (!isApiEnabled) saveTrainingAssignments(nextAssignments);
  };

  const completeCurrentTraining = async () => {
    if (!currentEmployee || !isAssignedToCurrentUser || isCurrentUserComplete || canManage) return;
    if (isApiEnabled) {
      const assignmentId = assignmentIds[`${trainingId}:${currentEmployee.id}`];
      if (!assignmentId) return;
      try { await completeTraining(assignmentId); }
      catch (requestError) { setError(requestError.message || "Could not complete training"); return; }
    }
    const nextCompletions = {
      ...completions,
      [trainingId]: { ...completedByEmployee, [currentEmployee.id]: { completedAt: new Date().toISOString(), completedBy: user?.userId } },
    };
    setCompletions(nextCompletions);
    if (!isApiEnabled) saveTrainingCompletions(nextCompletions, employees, library, assignments);
  };

  if (!training) return <AppShell><div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><h1 className="text-2xl font-black text-slate-950">Training not found</h1><button type="button" onClick={() => navigate(returnTo)} className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white">Back to training</button></div></AppShell>;

  const objectives = training.learningObjectives?.length ? training.learningObjectives : defaultObjectives(training);
  const content = training.documentContent || defaultTrainingContent(training);

  return <AppShell>
    <div className="mx-auto max-w-7xl space-y-5">
      <nav className="flex items-center justify-between"><button type="button" onClick={() => navigate(returnTo)} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-black text-slate-600 hover:bg-white hover:text-slate-950"><ArrowLeft size={17}/>Back to training</button><button type="button" onClick={() => navigate(returnTo)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900"><X size={18}/></button></nav>
      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="h-1.5 bg-gradient-to-r from-blue-800 via-blue-500 to-cyan-300"/><div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between lg:p-8"><div className="flex min-w-0 gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><BookOpen size={24}/></span><div><div className="mb-2 flex flex-wrap gap-2">{training.relatedFrameworks.map((framework) => <span key={framework} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600">{framework}</span>)}<span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${completionPercent === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{completionPercent}% completed</span></div><h1 className="text-3xl font-black text-slate-950">{training.name}</h1><p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{training.description}</p></div></div><div className="flex shrink-0 flex-wrap gap-2">{canManage ? <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white"><Edit3 size={16}/>{editing ? "Cancel editing" : "Edit training"}</button> : <button type="button" disabled={!isAssignedToCurrentUser || isCurrentUserComplete} onClick={completeCurrentTraining} className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><CheckCircle2 size={18}/>{isCurrentUserComplete ? "Completed" : "Mark as Completed"}</button>}</div></div></header>

      {editing && canManage ? <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-black text-slate-950">Edit training document</h2><button type="button" onClick={saveDocument} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white"><Save size={16}/>Save changes</button></div><div className="mt-5 grid gap-4 lg:grid-cols-2"><Field label="Training title"><input value={draft.name} onChange={(event) => setDraft({...draft,name:event.target.value})} className={editorClass}/></Field><Field label="Due date"><input type="date" value={draft.dueDate} onChange={(event) => setDraft({...draft,dueDate:event.target.value})} className={editorClass}/></Field><Field label="Description" wide><textarea value={draft.description} onChange={(event) => setDraft({...draft,description:event.target.value})} className={`${editorClass} min-h-24`}/></Field><Field label="Learning objectives (one per line)" wide><textarea value={draft.objectivesText} onChange={(event) => setDraft({...draft,objectivesText:event.target.value})} className={`${editorClass} min-h-32`}/></Field><Field label="Training document content" wide><textarea value={draft.documentContent} onChange={(event) => setDraft({...draft,documentContent:event.target.value})} className={`${editorClass} min-h-52`}/></Field></div></section> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4"><h2 className="font-black text-slate-900">Training document</h2><p className="mt-1 text-xs font-semibold text-slate-500">Read the complete material before recording completion.</p></div><div className="space-y-8 p-7 lg:p-10"><section><DocHeading number="01" title="Purpose and scope"/><p className="mt-4 whitespace-pre-line text-sm font-semibold leading-7 text-slate-600">{content}</p></section><section><DocHeading number="02" title="Learning objectives"/><ul className="mt-4 grid gap-3">{objectives.map((objective) => <li key={objective} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm font-semibold leading-6 text-slate-700"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600"/>{objective}</li>)}</ul></section><section><DocHeading number="03" title="Employee responsibilities"/><div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-5 text-sm font-semibold leading-7 text-amber-950">Apply the practices described in this training, report suspected violations promptly, follow organization policies, and ask your manager or security contact whenever requirements are unclear.</div></section><section><DocHeading number="04" title="Completion acknowledgement"/><p className="mt-4 text-sm font-semibold leading-7 text-slate-600">By marking this training complete, the employee confirms they have reviewed the material, understand their responsibilities, and agree to follow the applicable organizational requirements.</p></section></div></article>
        <aside className="space-y-4 xl:sticky xl:top-24"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Training details</h2><div className="mt-4 space-y-4"><Info icon={Clock3} label="Estimated duration" value="20–30 minutes"/><Info icon={CalendarDays} label="Due date" value={training.dueDate || "No due date"}/><Info icon={Users} label="Assigned employees" value={String(assignedIds.length)}/><Info icon={ShieldCheck} label="Completion" value={`${assignedIds.filter((id) => completedByEmployee[id]).length} of ${assignedIds.length}`}/></div></section>{canManage ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-slate-950">Employee progress</h2><span className="text-xs font-black text-blue-700">{completionPercent}%</span></div><div className="mt-4 max-h-96 space-y-2 overflow-y-auto">{employees.map((employee) => {const assigned=assignedIds.includes(employee.id);const completed=Boolean(completedByEmployee[employee.id]);return <label key={employee.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><input type="checkbox" checked={assigned} onChange={() => toggleAssignment(employee.id)} className="h-4 w-4 rounded border-slate-300 text-blue-600"/><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600">{(employee.name||"U")[0]}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-800">{employee.name}</span><span className={`text-[10px] font-bold ${completed ? "text-emerald-600" : assigned ? "text-amber-600" : "text-slate-400"}`}>{completed ? "Completed" : assigned ? "Pending" : "Not assigned"}</span></span></label>})}</div></section> : <section className={`rounded-2xl border p-5 ${isCurrentUserComplete ? "border-emerald-200 bg-emerald-50" : "border-blue-100 bg-blue-50"}`}><h2 className="text-sm font-black text-slate-950">Your status</h2><p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{isCurrentUserComplete ? `Completed ${new Date(completedByEmployee[currentEmployee.id].completedAt).toLocaleString()}` : isAssignedToCurrentUser ? "Assigned and awaiting completion." : "This training has not been assigned to you."}</p></section>}</aside>
      </div>
    </div>
  </AppShell>;
}

function createTrainingDraft(training) { return { name: training?.name || "", description: training?.description || "", dueDate: training?.dueDate || "", objectivesText: (training?.learningObjectives?.length ? training.learningObjectives : defaultObjectives(training)).join("\n"), documentContent: training?.documentContent || defaultTrainingContent(training) }; }
function defaultObjectives(training) { return [`Understand the purpose and scope of ${training?.name || "this training"}.`, "Recognize the employee responsibilities required by the organization.", "Apply the required practices during day-to-day work.", "Know how and when to report concerns or suspected incidents."]; }
function defaultTrainingContent(training) { return `${training?.description || "This training explains the organization's required compliance practices."}\n\nThis material applies to employees and contractors who access organization systems, information, facilities, or customer data. Follow the approved procedures and contact your manager or compliance team when clarification is required.`; }
function findCurrentEmployee(employees, user) { return employees.find((employee) => employee.email?.toLowerCase() === user?.email?.toLowerCase()) || employees.find((employee) => employee.name === user?.name) || employees.find((employee) => String(employee.id) === String(user?.userId)); }
function Field({ label, wide, children }) { return <label className={wide ? "lg:col-span-2" : ""}><span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>; }
function DocHeading({ number, title }) { return <div className="flex items-center gap-3"><span className="text-xs font-black text-amber-700">{number}</span><h2 className="text-xl font-black text-slate-950">{title}</h2></div>; }
function Info({ icon: Icon, label, value }) { return <div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500"><Icon size={15}/></span><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 text-sm font-black text-slate-800">{value}</p></div></div>; }
const editorClass = "mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
