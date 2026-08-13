import { useState, useEffect, useRef } from "react";
import { Users, Plus, Mail, Search, SlidersHorizontal, Edit2, Info, X, Trash2, FileSpreadsheet, Download, Upload } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { readScopedJson, writeScopedJson } from "../auth/session";
import { canManageWorkspace } from "../auth/session";
import { useUser } from "../auth/UserContext";
import { createLocalInvitations, revokeLocalInvitation, updateLocalOrganizationRole } from "../data/localAccounts";
import {
  getEmployeeTrainingCompliance,
  loadTrainingAssignments,
  loadTrainingCompletions,
  loadTrainingLibrary,
  saveTrainingCompletions,
} from "../training/TrainingService";
import { POLICY_STATUS_KEY } from "../policies/PolicyService";
import { isApiEnabled } from "../api/client";
import { completeBackgroundCheck, createEmployee, deleteEmployee, listEmployees, revokeEmployeeAccess, updateEmployee } from "../api/people";
import { changeMemberRole, createInvitation, revokeInvitation } from "../api/organizations";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";

const initialEmployees = [];

export default function Employees() {
  const { user } = useUser();
  const { selectedFrameworks } = useFrameworkWorkspace();
  const canManagePeople = canManageWorkspace(user?.role);
  const [employees, setEmployees] = useState(() => {
    try {
      return readScopedJson("spectramind:employees", initialEmployees);
    } catch {
      return initialEmployees;
    }
  });

  const [activeTab, setActiveTab] = useState("Employee List");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [employeeFilter, setEmployeeFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importFileName, setImportFileName] = useState("");
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [type, setType] = useState("Full-Time");
  const [hasAccess, setHasAccess] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tagsInput, setTagsInput] = useState("All Staff");
  const [loading, setLoading] = useState(isApiEnabled);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    if (!filterOpen) return undefined;
    const closeFilter = (event) => {
      if (!filterRef.current?.contains(event.target)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", closeFilter);
    return () => document.removeEventListener("mousedown", closeFilter);
  }, [filterOpen]);

  // Dynamic States for integration (no fake fallbacks)
  const [completionsState, setCompletionsState] = useState(() => {
    try {
      return loadTrainingCompletions();
    } catch {
      return {};
    }
  });
  const [trainingLibrary, setTrainingLibrary] = useState(() => loadTrainingLibrary());
  const [trainingAssignments, setTrainingAssignments] = useState(() => loadTrainingAssignments(employees, loadTrainingLibrary()));

  const [acknowledgementsState, setAcknowledgementsState] = useState(() => {
    try {
      return readScopedJson("spectramind:policy-acknowledgements", {});
    } catch {
      return {};
    }
  });
  const [policyStatusState, setPolicyStatusState] = useState(() => readScopedJson(POLICY_STATUS_KEY, {}));

  const [bgChecksState, setBgChecksState] = useState(() => {
    try {
      return readScopedJson("spectramind:background-checks", {});
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (!isApiEnabled) writeScopedJson("spectramind:employees", employees);
  }, [employees]);

  useEffect(() => {
    if (!isApiEnabled) return;
    let cancelled = false;
    listEmployees()
      .then((records) => {
        if (cancelled) return;
        const mapped = records.map(fromApiEmployee);
        setEmployees(mapped);
        setBgChecksState(Object.fromEntries(mapped.map((employee) => [employee.name, employee.backgroundCheckCompletedAt ? "Completed" : "Pending"])));
      })
      .catch((error) => { if (!cancelled) setApiError(error.message || "Could not load employees"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Listener to handle instant bidirectional sync when Policies/Training pages modify localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const nextLibrary = loadTrainingLibrary();
        setTrainingLibrary(nextLibrary);
        setTrainingAssignments(loadTrainingAssignments(employees, nextLibrary));
        setCompletionsState(loadTrainingCompletions());

        setAcknowledgementsState(readScopedJson("spectramind:policy-acknowledgements", {}));
        setPolicyStatusState(readScopedJson(POLICY_STATUS_KEY, {}));

        setBgChecksState(readScopedJson("spectramind:background-checks", {}));
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("spectramind:training-updated", handleStorageChange);
    window.addEventListener("spectramind:policy-updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("spectramind:training-updated", handleStorageChange);
      window.removeEventListener("spectramind:policy-updated", handleStorageChange);
    };
  }, [employees]);

  const handleToggleAccess = async (id) => {
    if (!canManagePeople) return;
    const employee = employees.find((item) => item.id === id);
    if (!employee) return;
    try {
      const updated = isApiEnabled ? fromApiEmployee(await updateEmployee(id, employee.version, { hasAccess: !employee.hasAccess })) : { ...employee, hasAccess: !employee.hasAccess };
      setEmployees((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) { setApiError(error.message || "Could not update access"); }
  };

  const handleToggleTraining = (trainingId, emp) => {
    const list = completionsState[trainingId] || [];
    const idKey = emp.id;
    const nextList = list[idKey]
      ? Object.fromEntries(Object.entries(list).filter(([id]) => id !== String(idKey)))
      : { ...list, [idKey]: { completedAt: new Date().toISOString() } };
    const nextCompletions = { ...completionsState, [trainingId]: nextList };
    setCompletionsState(nextCompletions);
    saveTrainingCompletions(nextCompletions, employees, trainingLibrary, trainingAssignments);
  };

  const handleToggleBgCheck = async (name) => {
    const employee = employees.find((item) => item.name === name);
    if (isApiEnabled && employee) {
      try {
        const updated = fromApiEmployee(await completeBackgroundCheck(employee.id));
        setEmployees((currentEmployees) => currentEmployees.map((item) => item.id === employee.id ? updated : item));
        setBgChecksState((current) => ({ ...current, [name]: "Completed" }));
      } catch (error) { setApiError(error.message || "Could not complete background check"); }
      return;
    }
    const current = bgChecksState[name] || "Pending";
    const next = current === "Completed" ? "Pending" : "Completed";
    const nextState = { ...bgChecksState, [name]: next };
    setBgChecksState(nextState);
    writeScopedJson("spectramind:background-checks", nextState);
    window.dispatchEvent(new Event("storage"));
  };

  const getEmployeeCompliance = (emp) => {
    const trainingCompliance = getEmployeeTrainingCompliance(emp, trainingLibrary, trainingAssignments, completionsState);
    const trainingOk = trainingCompliance.isCompliant;

    const policyAcknowledgements = Object.values(acknowledgementsState);
    const acknowledgedPolicies = policyAcknowledgements.filter((policyMap) => policyMap?.[emp.id] || policyMap?.[emp.name] === "Completed").length;
    const policyOk = policyStatusState[emp.id]?.isCompliant ?? (policyAcknowledgements.length > 0 && acknowledgedPolicies === policyAcknowledgements.length);

    const bgOk = bgChecksState[emp.name] === "Completed";

    const satisfiedCount = (trainingOk ? 1 : 0) + (policyOk ? 1 : 0) + (bgOk ? 1 : 0);
    const isCompliant = satisfiedCount === 3;

    return {
      trainingOk,
      policyOk,
      bgOk,
      satisfiedCount,
      isCompliant,
      statusLabel: isCompliant ? "COMPLIANT 3/3" : `NON-COMPLIANT ${satisfiedCount}/3`
    };
  };

  const handleOpenAddModal = () => {
    if (!canManagePeople) return;
    setEditingEmployeeId(null);
    setName("");
    setEmail("");
    setRole("User");
    setType("Full-Time");
    setHasAccess(true);
    setStartDate("");
    setEndDate("");
    setTagsInput("All Staff");
    setIsModalOpen(true);
  };

  const handleExcelFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setApiError(""); setImportFileName(file.name);
    try {
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const matrix = await readXlsxFile(file, { sheet: "Employees" }).catch(() => readXlsxFile(file));
      const [headers = [], ...bodyRows] = matrix;
      const data = bodyRows.map((values) => Object.fromEntries(headers.map((header, index) => [String(header || "").trim(), values[index] ?? ""])));
      const existingEmails = new Set(employees.map((employee) => employee.email.toLowerCase()));
      const fileEmails = new Set();
      setImportRows(data.filter((row) => Object.values(row).some(Boolean)).map((row, index) => normalizeImportRow(row, index + 2, existingEmails, fileEmails)));
    } catch (error) {
      setImportRows([]); setApiError(error.message || "Could not read this Excel file.");
    }
    event.target.value = "";
  };

  const handleImportEmployees = async () => {
    const validRows = importRows.filter((row) => !row.errors.length);
    if (!validRows.length) return;
    setSaving(true); setApiError("");
    try {
      const added = [];
      for (const row of validRows) {
        const input = toEmployeeInput(row.employee);
        added.push(isApiEnabled ? fromApiEmployee(await createEmployee(input)) : { id: `${Date.now()}-${added.length}`, ...fromApiEmployee(input), employeeStatus: "Active" });
      }
      setEmployees((current) => [...current, ...added]);
      setImportRows([]); setImportFileName(""); setIsImportModalOpen(false);
    } catch (error) { setApiError(error.message || "Could not import employees."); }
    finally { setSaving(false); }
  };

  const handleInviteEmployee = async (employee) => {
    if (!canManagePeople) return;
    setApiError("");
    try {
      const invitation = isApiEnabled
        ? await createInvitation({ email: employee.email, role: apiRole(employee.role) })
        : createLocalInvitations({ emails: [employee.email], role: employee.role, organizationId: user.organizationId, organizationName: user.organizationName, invitedBy: user.email })[0];
      setEmployees((current) => current.map((item) => item.id === employee.id ? { ...item, employeeStatus: "Invited", invitationId: invitation?.id, tags: [...new Set([...(item.tags || []), "Invited"])] } : item));
      setActionNotice(`Invitation sent internally to ${employee.email}.`);
    } catch (error) { setApiError(error.message || "Could not prepare this invitation."); }
  };

  const handleRevokeInvitation = async (employee) => {
    if (!canManagePeople) return;
    setApiError("");
    try {
      if (isApiEnabled) {
        if (!employee.invitationId) throw new Error("Pending invitation could not be identified. Refresh the page and try again.");
        await revokeInvitation(employee.invitationId);
      } else {
        revokeLocalInvitation({ email: employee.email, organizationId: user.organizationId });
      }
      setEmployees((current) => current.map((item) => item.id === employee.id ? {
        ...item,
        employeeStatus: "No access",
        invitationId: null,
        pendingInvitation: null,
        hasAccess: false,
        tags: (item.tags || []).filter((tag) => tag !== "Invited"),
      } : item));
      setActionNotice(`Invitation removed. ${employee.email} no longer has workspace access and can be invited again.`);
    } catch (error) { setApiError(error.message || "Could not remove this invitation."); }
  };

  const handleRemoveAccess = async (employee) => {
    if (!canRemoveEmployee(employee)) return;
    setApiError("");
    try {
      const updated = isApiEnabled
        ? fromApiEmployee(await revokeEmployeeAccess(employee.id))
        : { ...employee, membershipId: null, hasAccess: false, employeeStatus: "No access" };
      setEmployees((current) => current.map((item) => item.id === employee.id ? updated : item));
      setActionNotice(`${employee.email} no longer has workspace access. Their existing evidence has been retained.`);
    } catch (error) { setApiError(error.message || "Could not remove workspace access."); }
  };

  const canRemoveEmployee = (employee) => {
    if (!canManagePeople) return false;
    if (user.role === "Admin") return employee.email.toLowerCase() !== user.email.toLowerCase();
    return employee.role === "User";
  };

  const handleOpenEditModal = (emp) => {
    if (!canManagePeople) return;
    setEditingEmployeeId(emp.id);
    setName(emp.name);
    setEmail(emp.email);
    setRole(emp.role);
    setType(emp.type);
    setHasAccess(emp.hasAccess);
    setStartDate(emp.startDate === "-" ? "" : emp.startDate);
    setEndDate(emp.endDate === "-" ? "" : emp.endDate);
    setTagsInput(emp.tags.join(", "));
    setIsModalOpen(true);
  };

  const handleDeleteEmployee = async (id) => {
    const employee = employees.find((item) => item.id === id);
    if (!employee || !canRemoveEmployee(employee)) return;
    try {
      if (isApiEnabled) await deleteEmployee(id);
      setEmployees((current) => current.filter((emp) => emp.id !== id));
      window.dispatchEvent(new Event("storage"));
    } catch (error) { setApiError(error.message || "Could not delete employee"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const normalizedEmail = email.trim().toLowerCase();
    const duplicate = employees.find((employee) => employee.email.toLowerCase() === normalizedEmail && employee.id !== editingEmployeeId);
    if (duplicate) {
      setApiError("An employee with this email already exists. Edit the existing employee or send them an invitation.");
      return;
    }
    setSaving(true); setApiError("");
    const input = { name: name.trim(), email: normalizedEmail, jobRole: role, hasAccess, startDate: dateToIso(startDate), endDate: dateToIso(endDate), employmentType: type, tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      if (editingEmployeeId) {
        const current = employees.find((item) => item.id === editingEmployeeId);
        if (isApiEnabled && current.membershipId && apiRole(current.role) !== apiRole(role)) {
          await changeMemberRole(current.membershipId, apiRole(role));
        }
        const updated = isApiEnabled ? fromApiEmployee(await updateEmployee(editingEmployeeId, current.version, input)) : { ...current, ...fromApiEmployee(input) };
        setEmployees((items) => items.map((item) => item.id === editingEmployeeId ? updated : item));
        if (!isApiEnabled) updateLocalOrganizationRole({ email: updated.email, organizationId: user.organizationId, role: updated.role });
      } else {
        const newEmp = isApiEnabled ? fromApiEmployee(await createEmployee(input)) : { id: Date.now(), ...fromApiEmployee(input), employeeStatus: "Active" };
        setEmployees((items) => [...items, newEmp]);
      }

    setName("");
    setEmail("");
    setRole("User");
    setType("Full-Time");
    setHasAccess(true);
    setStartDate("");
    setEndDate("");
    setTagsInput("All Staff");
    setEditingEmployeeId(null);
    setIsModalOpen(false);
      window.dispatchEvent(new Event("storage"));
    } catch (error) { setApiError(error.message || "Could not save employee"); }
    finally { setSaving(false); }
  };

  const employeeMatchesFilter = (emp) => {
    const compliance = getEmployeeCompliance(emp);
    if (employeeFilter === "fully-compliant") return compliance.trainingOk && compliance.policyOk && compliance.bgOk;
    if (employeeFilter === "training") return compliance.trainingOk;
    if (employeeFilter === "policy") return compliance.policyOk;
    if (employeeFilter === "background") return compliance.bgOk;
    if (employeeFilter === "portal") return emp.hasAccess;
    return true;
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.role.toLowerCase().includes(searchTerm.toLowerCase())
  ).filter(employeeMatchesFilter);
  const selectedFrameworkNames = new Set(selectedFrameworks.map((framework) => framework.name));
  const selectedTrainingId = trainingLibrary.find((training) => training.relatedFrameworks?.some((framework) => selectedFrameworkNames.has(framework)))?.id || trainingLibrary[0]?.id;

  const totalEmps = employees.length;

  const trainingCompliantCount = employees.filter(e => {
    const comp = getEmployeeCompliance(e);
    return comp.trainingOk;
  }).length;

  const policyCompliantCount = employees.filter(e => {
    const comp = getEmployeeCompliance(e);
    return comp.policyOk;
  }).length;

  const bgCompliantCount = employees.filter(e => {
    const comp = getEmployeeCompliance(e);
    return comp.bgOk;
  }).length;

  const fullyCompliantCount = employees.filter(e => {
    const comp = getEmployeeCompliance(e);
    return comp.isCompliant;
  }).length;

  const fullyCompliantPercent = totalEmps ? Math.round((fullyCompliantCount / totalEmps) * 100) : 0;
  const trainingPercent = totalEmps ? Math.round((trainingCompliantCount / totalEmps) * 100) : 0;
  const policyPercent = totalEmps ? Math.round((policyCompliantCount / totalEmps) * 100) : 0;
  const bgPercent = totalEmps ? Math.round((bgCompliantCount / totalEmps) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {apiError && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{apiError}</p>}
        {actionNotice && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">{actionNotice}</p>}
        {loading && <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">Loading employees...</p>}
        {/* Header Section */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">Compliance</p>
            <h1 className="text-4xl font-black text-slate-900">Employee Compliance</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Monitor and manage employee compliance across all active compliance frameworks.
            </p>
            <div className="mt-4 rounded-lg bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
              <p className="text-sm font-black text-slate-900 mb-2">To ensure compliance:</p>
              <ul className="space-y-1 text-sm text-slate-600 list-disc list-inside">
                <li>Upload and review required policy documents on the <a href="/policies" className="text-blue-600 hover:underline">Policy Page</a>.</li>
                <li>Send invitations to employees to complete their tasks. They will be directed to the <a href="/tasks" className="text-blue-600 hover:underline">Tasks page</a>.</li>
                <li>Ensure all team members meet the necessary compliance standards.</li>
              </ul>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 mt-4 lg:mt-0">
            <button
              onClick={handleOpenAddModal}
              disabled={!canManagePeople}
              title={!canManagePeople ? "Only an Admin or Manager can add employees" : undefined}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Add Employee
            </button>
            <button onClick={() => canManagePeople && setIsImportModalOpen(true)} disabled={!canManagePeople} title={!canManagePeople ? "Only an Admin or Manager can import employees" : undefined} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
              <FileSpreadsheet size={16} />
              Import Excel
            </button>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-6">
            {["Employee List", "Employee Integrations"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-black transition-all border-b-2 ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "Employee List" ? (
          <>
            {/* Employee Compliance Overview card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-black text-slate-900">Employee Compliance Overview</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                    <Users size={12} />
                    {totalEmps} employees total
                  </span>
                </div>
                <div className="rounded-lg bg-rose-50 px-3 py-1.5 text-right dark:bg-rose-950/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-700">COMPLIANCE SCORE</p>
                  <p className="text-sm font-black text-rose-700">{fullyCompliantPercent}% Compliance Score</p>
                </div>
              </div>

              {/* Grid of stats */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">FULLY COMPLIANT</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{fullyCompliantCount} / {totalEmps}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{fullyCompliantPercent}% of active employees</p>
                  <button className="mt-4 text-xs font-black text-blue-600 hover:underline">View all need action &gt;</button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">TRAINING</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{trainingPercent}%</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{trainingCompliantCount} of {totalEmps} employees up to date</p>
                  <button className="mt-4 text-xs font-black text-blue-600 hover:underline">View behind &gt;</button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">POLICY ACKNOWLEDGEMENT</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{policyPercent}%</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{policyCompliantCount} of {totalEmps} employees up to date</p>
                  <button className="mt-4 text-xs font-black text-blue-600 hover:underline">View behind &gt;</button>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">BACKGROUND CHECK</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{bgPercent}%</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{bgCompliantCount} of {totalEmps} employees up to date</p>
                  <button className="mt-4 text-xs font-black text-blue-600 hover:underline">View behind &gt;</button>
                </div>
              </div>
            </div>

            {/* Frameworks grid */}
            <div className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                Frameworks
                <button className="text-slate-400 hover:text-slate-600">
                  <Info size={16} />
                </button>
              </h2>

              {selectedFrameworks.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedFrameworks.map((framework) => (
                    <div key={framework.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="flex items-start justify-between">
                        <div><h3 className="font-black text-slate-900">{framework.name}</h3><p className="text-xs font-semibold text-slate-500">{fullyCompliantCount} of {totalEmps} compliant</p></div>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${fullyCompliantPercent === 100 ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700"}`}>{fullyCompliantPercent}%</span>
                      </div>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Training</span><span className="font-black text-blue-600">{trainingPercent}%</span></div>
                        <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Policy</span><span className="font-black text-slate-900">{policyPercent}%</span></div>
                        <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Background Check</span><span className="font-black text-slate-900">{bgPercent}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-500">No frameworks selected for this organization.</div>
              )}
            </div>

            {/* Search/Filters row */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title or ID"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-850 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="relative" ref={filterRef}>
                <button
                  type="button"
                  onClick={() => setFilterOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <SlidersHorizontal size={16} />
                  Filters
                </button>
                {filterOpen ? (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                    {[
                      ["all", "All employees"],
                      ["fully-compliant", "Fully compliant"],
                      ["training", "Training complete"],
                      ["policy", "Policy acknowledged"],
                      ["background", "Background complete"],
                      ["portal", "Portal access enabled"],
                    ].map(([value, label]) => (
                      <EmployeeFilterOption
                        key={value}
                        active={employeeFilter === value}
                        onClick={() => setEmployeeFilter(value)}
                      >
                        {label}
                      </EmployeeFilterOption>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900/50">
                    <th className="px-6 py-4">Compliance Status</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">System Role</th>
                    <th className="px-6 py-4">Has Access To Client Portal</th>
                    <th className="px-6 py-4">Start Date</th>
                    <th className="px-6 py-4">End Date</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Roles</th>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                      <td className="whitespace-nowrap px-6 py-4">
                        {(() => {
                          const comp = getEmployeeCompliance(emp);
                          return (
                            <div className="flex flex-col gap-1.5">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-black rounded ${
                                comp.isCompliant ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {comp.statusLabel}
                              </span>
                              <div className="flex gap-1">
                                {selectedTrainingId && <button
                                  type="button"
                                  title="Toggle training completion"
                                  onClick={() => handleToggleTraining(selectedTrainingId, emp)}
                                  className={`h-4 rounded border px-1 text-[9px] font-black transition ${comp.trainingOk ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}
                                >Training</button>}
                                <button
                                  type="button"
                                  title="Toggle Background Check Status"
                                  onClick={() => handleToggleBgCheck(emp.name)}
                                  className={`h-4 px-1 text-[9px] font-black rounded border transition ${
                                    comp.bgOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
                                  }`}
                                >
                                  BG
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-slate-950 dark:text-white">
                        {emp.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-500">
                        {emp.email}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-800">
                        {emp.role}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <button
                          onClick={() => handleToggleAccess(emp.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            emp.hasAccess ? "bg-blue-600" : "bg-slate-200"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              emp.hasAccess ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-500">
                        {emp.startDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-500">
                        {emp.endDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-800">
                        {emp.type}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {emp.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`flex items-center gap-1.5 font-bold ${emp.employeeStatus === "Active" ? "text-emerald-600" : emp.employeeStatus === "Invited" ? "text-amber-700" : "text-slate-500"}`}>
                          <span className={`h-2 w-2 rounded-full ${emp.employeeStatus === "Active" ? "bg-emerald-500" : emp.employeeStatus === "Invited" ? "bg-amber-500" : "bg-slate-400"}`} />
                          {emp.employeeStatus}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title={emp.employeeStatus === "Invited" ? "Remove pending invitation" : emp.membershipId ? "Remove workspace access" : "Send workspace invitation"}
                            disabled={!canManagePeople || (Boolean(emp.membershipId) && !canRemoveEmployee(emp))}
                            onClick={() => emp.employeeStatus === "Invited" ? handleRevokeInvitation(emp) : emp.membershipId ? handleRemoveAccess(emp) : handleInviteEmployee(emp)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black disabled:cursor-not-allowed disabled:text-slate-400 ${emp.employeeStatus === "Invited" || emp.membershipId ? "text-rose-700 hover:bg-rose-50" : "text-blue-700 hover:bg-blue-50"}`}
                          >
                            <Mail size={14} />
                            {emp.employeeStatus === "Invited" ? "Remove invite" : emp.membershipId ? "Remove access" : "Send invite"}
                          </button>
                          <button
                            type="button"
                            title="Edit Employee"
                            onClick={() => handleOpenEditModal(emp)}
                            className="rounded-lg p-1.5 text-slate-450 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            title="Delete Employee"
                            disabled={!canRemoveEmployee(emp)}
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="rounded-lg p-1.5 text-slate-450 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-12 text-center text-sm font-semibold text-slate-400">
            No integrations configured.
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div onMouseDown={(event) => { if (event.target === event.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="max-h-[calc(100vh-3rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                {editingEmployeeId ? "Edit Employee" : "Add New Employee"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {apiError && (
                <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {apiError}
                </p>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  placeholder="e.g. John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  placeholder="e.g. john@company.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  >
                    <option value="Admin">Admin</option>
                    <option value="User">User</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                    Employee Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Contractor">Contractor</option>
                    <option value="Part-Time">Part-Time</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Has Access to Client Portal
                </span>
                <button
                  type="button"
                  onClick={() => setHasAccess(!hasAccess)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    hasAccess ? "bg-blue-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hasAccess ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-350">
                  Roles / Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none focus:border-blue-500 dark:border-slate-880 dark:bg-slate-955 dark:text-white"
                  placeholder="All Staff, HR, Engineering..."
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
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isImportModalOpen && (
        <div onMouseDown={(event) => { if (event.target === event.currentTarget) setIsImportModalOpen(false); }} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="max-h-[calc(100vh-3rem)] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-slate-950">Import employees from Excel</h3><p className="mt-1 text-sm text-slate-500">Download the template, keep its headers unchanged, then upload the completed .xlsx file.</p></div><button type="button" onClick={() => setIsImportModalOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
            <div className="mt-5 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-[1fr_auto]"><div><p className="font-black text-blue-950">Required format</p><p className="mt-1 text-sm leading-6 text-blue-900">Required: Full Name and Email. Optional: System Role, Employee Type, Portal Access, Start Date, End Date, and Tags.</p></div><a href="/templates/employee-import-template.xlsx" download className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 font-black text-blue-700"><Download size={17}/>Download template</a></div>
            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-5 py-8 text-center hover:border-blue-400 hover:bg-blue-50/30"><Upload size={28} className="text-blue-700"/><span className="mt-3 font-black text-slate-800">Choose completed Excel file</span><span className="mt-1 text-sm text-slate-500">.xlsx or .xls</span><input type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="sr-only"/></label>
            {importFileName && <p className="mt-3 text-sm font-semibold text-slate-600">Selected: {importFileName}</p>}
            {importRows.length > 0 && <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h4 className="font-black text-slate-900">Import preview</h4><p className="text-sm font-semibold text-slate-500">{importRows.filter((row) => !row.errors.length).length} valid · {importRows.filter((row) => row.errors.length).length} need attention</p></div><div className="max-h-72 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Validation</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.rowNumber} className="border-t border-slate-100"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2 font-semibold">{row.employee.name}</td><td className="px-3 py-2">{row.employee.email}</td><td className="px-3 py-2">{row.employee.role}</td><td className="px-3 py-2">{row.employee.type}</td><td className={`px-3 py-2 font-semibold ${row.errors.length ? "text-rose-700" : "text-emerald-700"}`}>{row.errors.length ? row.errors.join("; ") : "Ready"}</td></tr>)}</tbody></table></div></div>}
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setIsImportModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold">Cancel</button><button type="button" onClick={handleImportEmployees} disabled={saving || !importRows.some((row) => !row.errors.length)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><FileSpreadsheet size={16}/>{saving ? "Importing..." : "Add valid employees"}</button></div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function dateToIso(value) {
  if (!value || value === "-") return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid start and end date.");
  return date.toISOString();
}

function normalizeImportRow(source, rowNumber, existingEmails, fileEmails) {
  const value = (header) => source[header] ?? "";
  const email = String(value("Email")).trim().toLowerCase();
  const role = canonicalValue(value("System Role"), ["User", "Manager", "Admin"], "User");
  const type = canonicalValue(value("Employee Type"), ["Full-Time", "Part-Time", "Contractor"], "Full-Time");
  const portalValue = String(value("Portal Access") || "Yes").trim().toLowerCase();
  const employee = {
    name: String(value("Full Name")).trim(),
    email,
    role,
    type,
    hasAccess: !["no", "false", "0"].includes(portalValue),
    startDate: normalizeExcelDate(value("Start Date")),
    endDate: normalizeExcelDate(value("End Date")),
    tags: String(value("Tags") || "All Staff").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
  const errors = [];
  if (!employee.name) errors.push("Full Name is required");
  if (!/^\S+@\S+\.\S+$/.test(email)) errors.push("Valid Email is required");
  if (existingEmails.has(email)) errors.push("Email already exists");
  if (fileEmails.has(email)) errors.push("Duplicate email in file");
  if (email) fileEmails.add(email);
  if (!role) errors.push("Role must be User, Manager, or Admin");
  if (!type) errors.push("Type must be Full-Time, Part-Time, or Contractor");
  if (value("Start Date") && !employee.startDate) errors.push("Invalid Start Date");
  if (value("End Date") && !employee.endDate) errors.push("Invalid End Date");
  return { rowNumber, employee: { ...employee, role: role || String(value("System Role")), type: type || String(value("Employee Type")) }, errors };
}

function canonicalValue(value, choices, fallback) {
  if (!String(value).trim()) return fallback;
  return choices.find((choice) => choice.toLowerCase() === String(value).trim().toLowerCase()) || "";
}

function normalizeExcelDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toEmployeeInput(employee) {
  return {
    name: employee.name,
    email: employee.email,
    jobRole: employee.role,
    employmentType: employee.type,
    hasAccess: employee.hasAccess,
    startDate: dateToIso(employee.startDate),
    endDate: dateToIso(employee.endDate),
    tags: employee.tags,
  };
}

function fromApiEmployee(employee) {
  const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : "-";
  const invitation = employee.pendingInvitation;
  const tags = (employee.tags || []).filter((tag) => tag !== "Invited");
  return {
    ...employee,
    role: employee.jobRole || employee.role || "User",
    type: employee.employmentType || employee.type || "Full-Time",
    startDate: date(employee.startDate),
    endDate: date(employee.endDate),
    tags: invitation ? [...new Set([...tags, "Invited"])] : tags,
    invitationId: invitation?.id || null,
    employeeStatus: invitation ? "Invited" : employee.membershipId ? "Active" : "No access",
  };
}

function apiRole(role) {
  return role === "Admin" ? "ADMIN" : role === "Manager" || role === "Compliance Manager" ? "COMPLIANCE_MANAGER" : "EMPLOYEE";
}

function EmployeeFilterOption({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${
        active ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
      }`}>
        {active ? <span className="h-1.5 w-1.5 rounded-sm bg-white" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}
