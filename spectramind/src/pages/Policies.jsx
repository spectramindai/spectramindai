import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FileText, Search, SlidersHorizontal, ChevronDown, X, ShieldAlert, Download, Settings, Upload, Trash2, ExternalLink } from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import { readScopedJson, writeScopedJson } from "../auth/session";
import { useUser } from "../auth/UserContext";
import { CMMC_FRAMEWORK_ID, getFrameworkLibrary, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";
import { useCMMCWorkflowState } from "../features/cmmc/hooks";
import {
  buildCMMCPolicyDocumentRows,
} from "../features/cmmc/services";
import {
  archivePolicy,
  buildDefaultPolicyDocument,
  canManagePolicies,
  canPublishPolicies,
  createCustomPolicy,
  getPolicyMetrics,
  loadPolicyAcknowledgements,
  loadPolicyAssignments,
  loadPolicyLibrary,
  publishPolicy,
  resetPolicyAcknowledgements,
  savePolicyAcknowledgements,
  savePolicyAssignments,
  savePolicyLibrary,
  updatePolicy,
} from "../policies/PolicyService";

// Sourced dynamically from the framework engine and organization workspace state

import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { buildCrossModuleTarget } from "../navigation/crossModuleNavigation";
import { useEffect } from "react";
import { isApiEnabled } from "../api/client";
import { acknowledgePolicy, assignPolicy, createPolicyApi, listEmployees, resetPolicyAcknowledgement, synchronizePolicies, updatePolicyApi } from "../api/people";
import { loadApiWorkspace, saveApiWorkspaceItem } from "../api/workspace";

const POLICY_FIELDS_KEY = "spectramind:policy-fields";
const DEFAULT_POLICY_FIELDS = [
  {
    id: "title",
    label: "Title",
    type: "Text",
    required: true,
    system: true,
    description: "Policy name shown in the table and drawer.",
  },
  {
    id: "publishing-status",
    label: "Publishing Status",
    type: "Status",
    required: true,
    system: true,
    description: "Current publication state for workflow tracking.",
  },
  {
    id: "acknowledged",
    label: "Acknowledged",
    type: "Number",
    required: false,
    system: true,
    description: "Employee acknowledgement completion for assigned policies.",
  },
  {
    id: "next-version",
    label: "Next Version",
    type: "Text",
    required: false,
    system: true,
    description: "Policy version currently being prepared or reviewed.",
  },
  {
    id: "reviewers",
    label: "Reviewers",
    type: "People",
    required: false,
    system: true,
    description: "People responsible for policy review.",
  },
  {
    id: "assigned-to",
    label: "Assigned To",
    type: "People",
    required: true,
    system: true,
    description: "Policy owner or accountable team member.",
  },
  {
    id: "renewal-frequency",
    label: "Renewal Frequency",
    type: "Date",
    required: false,
    system: true,
    description: "Review date or renewal cadence.",
  },
  {
    id: "frameworks",
    label: "Frameworks",
    type: "Multi-select",
    required: true,
    system: true,
    description: "Frameworks connected to this policy.",
  },
  {
    id: "document",
    label: "Document",
    type: "File",
    required: false,
    system: true,
    description: "Policy document attached to the policy record.",
  },
];

export default function Policies() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <PoliciesContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function PoliciesContent({ activeFramework }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedFrameworks, setActiveFramework } = useFrameworkWorkspace();
  const targetItemId = new URLSearchParams(location.search).get("item");
  const { policies: frameworkPolicies, tests: frameworkTests, workspaceData, actions } = useComplianceState();
  const { controlWorkflowFields, evidenceWorkflowFields, updateControlWorkflowStatus } = useCMMCWorkflowState();
  const { user } = useUser();
  const isCMMCWorkspace = resolveFrameworkId(activeFramework.id) === CMMC_FRAMEWORK_ID;
  const canManage = canManagePolicies(user);
  const canPublish = canPublishPolicies(user);
  const canEditGenericPolicies = canPublish && !isCMMCWorkspace;
  const [employees, setEmployees] = useState(() => readScopedJson("spectramind:employees", []));
  const [policyLibrary, setPolicyLibrary] = useState(() => loadPolicyLibrary(activeFramework.id, frameworkPolicies, activeFramework));
  const [policyAssignments, setPolicyAssignments] = useState(() =>
    loadPolicyAssignments(activeFramework.id, readScopedJson("spectramind:employees", []), loadPolicyLibrary(activeFramework.id, frameworkPolicies, activeFramework))
  );

  const [acknowledgementsState, setAcknowledgementsState] = useState(() => {
    try {
      return loadPolicyAcknowledgements(activeFramework.id);
    } catch {
      return {};
    }
  });
  const [newPolicyName, setNewPolicyName] = useState("");
  const [newPolicyDescription, setNewPolicyDescription] = useState("");
  const [newPolicyDocument, setNewPolicyDocument] = useState(null);
  const [newPolicyFieldValues, setNewPolicyFieldValues] = useState({});
  const [showCreatePolicy, setShowCreatePolicy] = useState(false);
  const [policyFields, setPolicyFields] = useState(() => loadPolicyFields(activeFramework.id));
  const [showCreateField, setShowCreateField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("Text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [assignmentIds, setAssignmentIds] = useState({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(isApiEnabled);

  useEffect(() => {
    if (!isApiEnabled || isCMMCWorkspace) return;
    let cancelled = false;
    const frameworkId = resolveFrameworkId(activeFramework.id) || activeFramework.id;
    Promise.all([listEmployees(), synchronizePolicies(frameworkId), loadApiWorkspace(frameworkId)])
      .then(([employeeRecords, policies, workspace]) => {
        if (cancelled) return;
        const mappedEmployees = employeeRecords.map((employee) => ({ ...employee, role: employee.jobRole || "User", type: employee.employmentType || "Full-Time" }));
        const mappedPolicies = policies.map((policy) => fromApiPolicy(policy, activeFramework));
        setEmployees(mappedEmployees);
        setPolicyLibrary(mappedPolicies);
        setPolicyAssignments(Object.fromEntries(policies.map((policy) => [policy.id, policy.assignments.map((assignment) => assignment.employeeId)])));
        setAcknowledgementsState(Object.fromEntries(policies.map((policy) => [policy.id, Object.fromEntries(policy.assignments.filter((assignment) => assignment.acknowledgedAt).map((assignment) => [assignment.employeeId, { acknowledgedAt: assignment.acknowledgedAt }]))])));
        setAssignmentIds(Object.fromEntries(policies.flatMap((policy) => policy.assignments.map((assignment) => [`${policy.id}:${assignment.employeeId}`, assignment.id]))));
        if (Array.isArray(workspace?.["__policy_fields"]?.fields)) {
          setPolicyFields(workspace["__policy_fields"].fields);
        }
      })
      .catch((error) => { if (!cancelled) setApiError(error.message || "Could not load policies"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeFramework, isCMMCWorkspace]);

  const persistLibrary = (nextLibrary, nextAcknowledgements = acknowledgementsState, nextAssignments = policyAssignments) => {
    setPolicyLibrary(nextLibrary);
    if (!isApiEnabled) {
      savePolicyLibrary(activeFramework.id, nextLibrary);
      savePolicyAcknowledgements(activeFramework.id, nextAcknowledgements, employees, nextLibrary, nextAssignments);
    }
  };

  const persistAssignments = (nextAssignments) => {
    setPolicyAssignments(nextAssignments);
    if (!isApiEnabled) {
      savePolicyAssignments(activeFramework.id, nextAssignments);
      savePolicyAcknowledgements(activeFramework.id, acknowledgementsState, employees, policyLibrary, nextAssignments);
    }
  };

  const persistPolicyFields = (nextFields) => {
    setPolicyFields(nextFields);
    if (isApiEnabled) {
      const frameworkId = resolveFrameworkId(activeFramework.id) || activeFramework.id;
      saveApiWorkspaceItem(frameworkId, "__policy_fields", { fields: nextFields }, undefined, "policy_fields")
        .catch((error) => setApiError(error.message || "Could not save policy fields"));
    } else {
      writeScopedJson(policyFieldsStorageKey(activeFramework.id), nextFields, {
        eventName: "spectramind:policy-fields-updated",
      });
    }
  };

  const handleToggleAcknowledgement = async (policyId, employeeId) => {
    const policyMap = acknowledgementsState[policyId] || {};
    const currentStatus = policyMap[employeeId];
    const nextState = {
      ...acknowledgementsState,
      [policyId]: currentStatus
        ? Object.fromEntries(Object.entries(policyMap).filter(([id]) => id !== String(employeeId)))
        : {
            ...policyMap,
            [employeeId]: { acknowledgedAt: new Date().toISOString(), acknowledgedBy: user?.userId },
          },
    };

    if (isApiEnabled) {
      const assignmentId = assignmentIds[`${policyId}:${employeeId}`];
      if (!assignmentId) return;
      try { if (currentStatus) await resetPolicyAcknowledgement(assignmentId); else await acknowledgePolicy(assignmentId); }
      catch (error) { setApiError(error.message || "Could not update acknowledgement"); return; }
    }
    setAcknowledgementsState(nextState);
    if (!isApiEnabled) savePolicyAcknowledgements(activeFramework.id, nextState, employees, policyLibrary, policyAssignments);
  };

  const updatePolicyField = async (policyId, updates) => {
    if (!canEditGenericPolicies) return;
    const currentPolicy = policyLibrary.find((policy) => policy.id === policyId);
    const nextLibrary = updatePolicy(policyLibrary, policyId, updates);
    if (isApiEnabled) {
      const apiUpdates = policyUpdatesForApi(updates);
      if (Object.keys(apiUpdates).length) {
        try { const updated = await updatePolicyApi(policyId, currentPolicy.apiVersion, apiUpdates); currentPolicy.apiVersion = updated.version; }
        catch (error) { setApiError(error.message || "Could not update policy"); return; }
      }
    }
    const nextAcknowledgements =
      currentPolicy?.requireReacknowledgement && (updates.name !== undefined || updates.description !== undefined || updates.version !== undefined)
        ? resetPolicyAcknowledgements(acknowledgementsState, policyId)
        : acknowledgementsState;
    setAcknowledgementsState(nextAcknowledgements);
    persistLibrary(nextLibrary, nextAcknowledgements);
  };

  const handlePublish = async (policyId) => {
    if (!canPublish) return;
    if (isCMMCWorkspace) {
      const cmmcPolicy = policies.find((item) => item.id === policyId);
      const controlId = cmmcPolicy?.policy?.sourcePolicy?.controlId;
      if (controlId) updateControlWorkflowStatus(controlId, "Completed");
      return;
    }
    if (!canEditGenericPolicies) return;
    const policy = policyLibrary.find((item) => item.id === policyId);
    if (isApiEnabled) { try { const updated = await updatePolicyApi(policyId, policy.apiVersion, { status: "ACTIVE" }); policy.apiVersion = updated.version; } catch (error) { setApiError(error.message); return; } }
    persistLibrary(publishPolicy(policyLibrary, policyId));
  };

  const handleArchivePolicy = async (policyId) => {
    if (!canEditGenericPolicies) return;
    const policy = policyLibrary.find((item) => item.id === policyId);
    if (isApiEnabled) { try { const updated = await updatePolicyApi(policyId, policy.apiVersion, { status: "ARCHIVED" }); policy.apiVersion = updated.version; } catch (error) { setApiError(error.message); return; } }
    persistLibrary(archivePolicy(policyLibrary, policyId));
  };

  const handleAssignmentToggle = async (policyId, employeeId) => {
    if (!canEditGenericPolicies) return;
    const current = policyAssignments[policyId] || [];
    const next = current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId];
    if (isApiEnabled) {
      try {
        await assignPolicy(policyId, next);
        const policies = await synchronizePolicies(resolveFrameworkId(activeFramework.id) || activeFramework.id);
        const policy = policies.find((item) => item.id === policyId);
        setAssignmentIds((ids) => ({ ...ids, ...Object.fromEntries((policy?.assignments || []).map((assignment) => [`${policyId}:${assignment.employeeId}`, assignment.id])) }));
      } catch (error) { setApiError(error.message || "Could not update policy assignments"); return; }
    }
    persistAssignments({ ...policyAssignments, [policyId]: next });
  };

  const handleCreatePolicy = async () => {
    if (!canEditGenericPolicies || !newPolicyName.trim()) return;
    let nextLibrary = createCustomPolicy(activeFramework.id, policyLibrary, {
      name: newPolicyName.trim(),
      description: newPolicyDescription.trim(),
      owner: user?.name || "Unassigned",
      document: newPolicyDocument,
      customFieldValues: newPolicyFieldValues,
    }, activeFramework);
    let newPolicy = nextLibrary[nextLibrary.length - 1];
    if (isApiEnabled) {
      try {
        const created = await createPolicyApi({
          frameworkId: resolveFrameworkId(activeFramework.id) || activeFramework.id,
          name: newPolicy.name,
          description: newPolicy.description,
          ownerName: newPolicy.owner,
          versionLabel: newPolicy.version,
          document: newPolicy.document,
          customFieldValues: newPolicy.customFieldValues,
          versionHistory: newPolicy.versionHistory,
          requireReacknowledgement: newPolicy.requireReacknowledgement,
        });
        newPolicy = fromApiPolicy({ ...created, assignments: [] }, activeFramework);
        nextLibrary = [...nextLibrary.slice(0, -1), newPolicy];
      } catch (error) { setApiError(error.message || "Could not create policy"); return; }
    }
    const nextAssignments = { ...policyAssignments, [newPolicy.id]: [] };
    setNewPolicyName("");
    setNewPolicyDescription("");
    setNewPolicyDocument(null);
    setNewPolicyFieldValues({});
    setShowCreatePolicy(false);
    setPolicyAssignments(nextAssignments);
    if (!isApiEnabled) savePolicyAssignments(activeFramework.id, nextAssignments);
    persistLibrary(nextLibrary, acknowledgementsState, nextAssignments);
  };

  const handleCreateField = () => {
    if (!newFieldLabel.trim()) return;
    const field = {
      id: `custom-field-${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      required: newFieldRequired,
      system: false,
      description: `Custom ${newFieldType.toLowerCase()} field for policy records.`,
    };
    persistPolicyFields([...policyFields, field]);
    setNewFieldLabel("");
    setNewFieldType("Text");
    setNewFieldRequired(false);
    setShowCreateField(false);
  };

  const handleNewPolicyFieldValueChange = (fieldId, value) => {
    setNewPolicyFieldValues((current) => ({ ...current, [fieldId]: value }));
  };

  const handleSelectedPolicyFieldValueChange = (fieldId, value) => {
    if (!selectedPolicy) return;
    updatePolicyField(selectedPolicy.id, {
      customFieldValues: {
        ...(selectedPolicy.policy.customFieldValues || {}),
        [fieldId]: value,
      },
    });
  };

  const handleToggleFieldRequired = (fieldId) => {
    persistPolicyFields(
      policyFields.map((field) =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    );
  };

  const handleDeleteField = (fieldId) => {
    persistPolicyFields(policyFields.filter((field) => field.id !== fieldId || field.system));
  };

  const currentEmployee = employees.find((employee) => employee.email?.toLowerCase() === user?.email?.toLowerCase()) ||
    employees.find((employee) => employee.name === user?.name);

  const cmmcPolicyDocumentRows = useMemo(
    () =>
      buildCMMCPolicyDocumentRows({
        controlWorkflowFields,
        evidenceWorkflowFields,
      }),
    [controlWorkflowFields, evidenceWorkflowFields]
  );
  const cmmcStoredPolicies = isCMMCWorkspace
    ? loadPolicyLibrary(
        activeFramework.id,
        cmmcPolicyDocumentRows.map(cmmcRowToLibraryPolicy),
        activeFramework
      )
    : [];
  const cmmcStoredPoliciesById = new Map(cmmcStoredPolicies.map((policy) => [policy.id, policy]));
  const genericPolicies = policyLibrary.map((p) => {
    const saved = workspaceData[p.id] ?? {};
    const activeAcks = acknowledgementsState[p.id] || {};
    const metrics = getPolicyMetrics(p, employees, policyAssignments, acknowledgementsState);
    const assignedEmployees = employees.filter((employee) => (policyAssignments[p.id] || []).includes(employee.id));
    const visibleAcknowledgementEmployees = canManage ? assignedEmployees : assignedEmployees.filter((employee) => employee.id === currentEmployee?.id);
    const acknowledgementsList = visibleAcknowledgementEmployees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      status: activeAcks[employee.id] ? "Completed" : "Pending",
    }));
    const sourcePolicy = p.sourcePolicy || {};

    return {
      id: p.id,
      title: p.name,
      description: p.description,
      status: p.status,
      acknowledged: `${metrics.acknowledged}/${metrics.assigned}`,
      nextVersion: p.version,
      reviewers: "-",
      assignedTo: p.owner || saved.assignments?.owner || "Unassigned",
      renewalFrequency: p.reviewDate || "-",
      frameworks: p.relatedFrameworks.join(", "),
      otherFrameworks: "-",
      tags: ["All Staff"],
      documentName: p.document?.name || "",
      documentDate: p.document?.uploadedAt ? new Date(p.document.uploadedAt).toLocaleDateString() : p.effectiveDate || "-",
      acknowledgements: acknowledgementsList,
      metrics,
      policy: p,
      connectedTests: (sourcePolicy.linkedTests || []).map((testId) => {
        const test = frameworkTests.find((item) => item.id === testId);
        return {
          id: testId,
          title: test?.title || testId,
          description: test?.description || test?.guidance || test?.title || testId,
          owner: workspaceData[testId]?.assignments?.owner || test?.owner || "Unassigned",
          status: workspaceData[testId]?.status || test?.status || "Not Started",
        };
      })
    };
  });
  const policies = isCMMCWorkspace
    ? cmmcPolicyDocumentRows.map((row) => buildCMMCPolicyPageRow(row, activeFramework, cmmcStoredPoliciesById.get(row.key)))
    : genericPolicies;


  const [selectedPolicyId, setSelectedPolicyId] = useState(null);
  const [drawerClosed, setDrawerClosed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("policies");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("title");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compactRows, setCompactRows] = useState(false);
  const [showFrameworkColumn, setShowFrameworkColumn] = useState(true);
  const filterMenuRef = useRef(null);
  const sortMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const visiblePolicies = canPublish
    ? policies
    : policies.filter((policy) => {
        const isPredefined = policy.policy?.custom !== true;
        const isPublished = ["active", "published"].includes(String(policy.status || "").toLowerCase());
        return isPredefined || isPublished;
      });

  useEffect(() => {
    const refresh = () => {
      const nextEmployees = readScopedJson("spectramind:employees", []);
      const nextLibrary = loadPolicyLibrary(activeFramework.id, frameworkPolicies, activeFramework);
      setEmployees(nextEmployees);
      setPolicyLibrary(nextLibrary);
      setPolicyAssignments(loadPolicyAssignments(activeFramework.id, nextEmployees, nextLibrary));
      setAcknowledgementsState(loadPolicyAcknowledgements(activeFramework.id));
    };
    window.addEventListener("storage", refresh);
    window.addEventListener("spectramind:policy-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("spectramind:policy-updated", refresh);
    };
  }, [activeFramework, frameworkPolicies]);

  useEffect(() => {
    if (!filterOpen && !sortOpen && !settingsOpen) return undefined;

    const handleOutsideClick = (event) => {
      const target = event.target;
      const clickedInsideMenu = [filterMenuRef, sortMenuRef, settingsMenuRef].some((ref) =>
        ref.current?.contains(target)
      );

      if (!clickedInsideMenu) {
        setFilterOpen(false);
        setSortOpen(false);
        setSettingsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [filterOpen, sortOpen, settingsOpen]);

  /* eslint-disable react-hooks/set-state-in-effect -- synchronize drawer selection with deep links and loaded policies */
  useEffect(() => {
    if (targetItemId && visiblePolicies.some((policy) => policy.id === targetItemId)) {
      setDrawerClosed(false);
      setSelectedPolicyId(targetItemId);
      return;
    }
    if (visiblePolicies.length && !selectedPolicyId && !drawerClosed) {
      setSelectedPolicyId(visiblePolicies[0].id);
    }
  }, [targetItemId, visiblePolicies, selectedPolicyId, drawerClosed]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedPolicy = visiblePolicies.find((p) => p.id === selectedPolicyId);
  const openImplementationRecord = (itemId, itemType = "Control") => {
    if (isCMMCWorkspace) {
      const policyKey = selectedPolicy?.id || itemId;
      navigate(`/cmmc/evidence?tab=policies&item=${encodeURIComponent(policyKey)}`);
      return;
    }

    const target = buildCrossModuleTarget({
      activeFramework,
      itemId,
      itemType,
      moduleContext: `Policy:${selectedPolicyId || ""}`,
      mode: "view",
    });
    navigate(target.path, { state: target.state });
  };

  const handleArchive = (policyId) => {
    handleArchivePolicy(policyId);
    const currentState = workspaceData[policyId] ?? {};
    actions.saveComplianceItem(policyId, {
      ...currentState,
      status: "complete", // switches legacy flow to active flow
      timeline: [
        // eslint-disable-next-line react-hooks/purity
        { id: `archive-${Date.now()}`, label: "Policy archived and legacy flow cleared" },
        ...(currentState.timeline ?? []),
      ],
    });
    handleCloseDrawer();
  };

  const handleToggleApplicability = (policyId) => {
    const currentState = workspaceData[policyId] ?? {};
    const isCurrentNotApplicable = currentState.status === "not_applicable" || currentState.status === "Not Applicable";
    const nextStatus = isCurrentNotApplicable ? "complete" : "not_applicable";
    actions.saveComplianceItem(policyId, {
      ...currentState,
      status: nextStatus,
      timeline: [
        {
          id: `app-${Date.now()}`,
          label: nextStatus === "not_applicable" ? "Policy marked as not applicable" : "Policy marked as applicable"
        },
        ...(currentState.timeline ?? []),
      ],
    });
  };

  const handleCloseDrawer = () => {
    setDrawerClosed(true);
    setSelectedPolicyId(null);
  };

  const handleSelectPolicy = (policyId) => {
    setDrawerClosed(false);
    setSelectedPolicyId(policyId);
  };

  const handleDownloadPolicy = (policy) => {
    if (policy.policy?.document?.dataUrl) {
      const link = document.createElement("a");
      link.href = policy.policy.document.dataUrl;
      link.download = policy.policy.document.name || `${policy.title}.pdf`;
      link.click();
      return;
    }

    const content = [
      `Title: ${policy.title}`,
      `Status: ${policy.status}`,
      `Version: ${policy.policy?.version || "-"}`,
      `Owner: ${policy.policy?.owner || policy.assignedTo || "Unassigned"}`,
      `Frameworks: ${policy.frameworks || activeFramework.name}`,
      "",
      policy.description || policy.policy?.description || "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${policy.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "policy"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDocumentSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setNewPolicyDocument({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSelectedPolicyDocument = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPolicy || !canEditGenericPolicies) return;

    const reader = new FileReader();
    reader.onload = () => {
      updatePolicyField(selectedPolicy.id, {
        document: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl: reader.result,
        },
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleDeleteSelectedPolicyDocument = () => {
    if (!selectedPolicy || !canEditGenericPolicies) return;
    updatePolicyField(selectedPolicy.id, { document: null });
  };

  const openSelectedPolicyDocument = () => {
    if (!selectedPolicy) return;
    const returnParams = new URLSearchParams(location.search);
    returnParams.set("item", selectedPolicy.id);
    navigate(`/policies/${encodeURIComponent(selectedPolicy.id)}/document`, {
      state: { returnTo: `${location.pathname}?${returnParams.toString()}` },
    });
  };

  const matchesStatusFilter = (policy) => {
    const status = String(policy.status || "").toLowerCase();
    if (statusFilter === "published") return status.includes("published");
    if (statusFilter === "draft") return status.includes("draft");
    if (statusFilter === "review") return status.includes("review");
    if (statusFilter === "not_applicable") return status.includes("not_applicable") || status.includes("not applicable");
    return true;
  };

  const filteredPolicies = visiblePolicies
    .filter((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(matchesStatusFilter)
    .sort((a, b) => {
      if (sortBy === "status") return String(a.status).localeCompare(String(b.status));
      if (sortBy === "owner") return String(a.assignedTo).localeCompare(String(b.assignedTo));
      if (sortBy === "framework") return String(a.frameworks).localeCompare(String(b.frameworks));
      return String(a.title).localeCompare(String(b.title));
    });
  const filteredPolicyFields = policyFields.filter((field) =>
    field.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.type.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const customPolicyFields = policyFields.filter((field) => !field.system);
  const canCreatePolicy =
    newPolicyName.trim() &&
    customPolicyFields.every((field) => !field.required || String(newPolicyFieldValues[field.id] || "").trim());
  const totalPolicies = visiblePolicies.length;
  const notApplicablePolicies = visiblePolicies.filter((policy) =>
    ["not_applicable", "not applicable"].includes(String(policy.status).toLowerCase())
  ).length;
  const publishedPolicies = visiblePolicies.filter((policy) =>
    String(policy.status).toLowerCase().includes("published")
  ).length;
  const assignedAcknowledgements = visiblePolicies.reduce((sum, policy) => sum + (policy.metrics?.assigned || 0), 0);
  const completedAcknowledgements = visiblePolicies.reduce((sum, policy) => sum + (policy.metrics?.acknowledged || 0), 0);
  const acknowledgementPercentage = assignedAcknowledgements
    ? Math.round((completedAcknowledgements / assignedAcknowledgements) * 100)
    : 0;
  const publishedPercentage = totalPolicies ? Math.round((publishedPolicies / totalPolicies) * 100) : 0;
  const workflowCounts = {
    notStarted: visiblePolicies.filter((policy) => {
      const status = String(policy.status).toLowerCase();
      return status.includes("not started") || status.includes("not_started") || status === "";
    }).length,
    draft: visiblePolicies.filter((policy) => String(policy.status).toLowerCase().includes("draft")).length,
    inReview: visiblePolicies.filter((policy) => String(policy.status).toLowerCase().includes("review")).length,
    approved: visiblePolicies.filter((policy) => String(policy.status).toLowerCase().includes("approved")).length,
    published: publishedPolicies,
  };
  const scopedFrameworks = selectedFrameworks.length ? selectedFrameworks : [activeFramework];
  const frameworkCards = scopedFrameworks.map((framework) => {
    const frameworkName = framework.shortName || framework.name;
    const frameworkPolicies = visiblePolicies.filter((policy) =>
      String(policy.frameworks || "").toLowerCase().includes(frameworkName.toLowerCase())
    );
    const mappedPolicyCount = getMappedPolicyCount(framework.id);
    const applicableCount = frameworkPolicies.length || (framework.id === activeFramework.id ? totalPolicies : mappedPolicyCount);
    const publishedCount = frameworkPolicies.length
      ? frameworkPolicies.filter((policy) => String(policy.status).toLowerCase().includes("published")).length
      : framework.id === activeFramework.id
      ? publishedPolicies
      : 0;
    const percent = applicableCount ? Math.round((publishedCount / applicableCount) * 100) : 0;

    return {
      id: framework.id,
      name: frameworkName,
      applicableCount,
      publishedCount,
      percent,
    };
  });

  return (
    <AppShell>
      <div className="space-y-6">
        {apiError && <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 font-semibold text-rose-700">{apiError}</p>}
        {loading && <p className="rounded-lg border border-slate-200 bg-white p-4 text-slate-500">Loading policies...</p>}
        <header className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">
                Policy Compliance
              </h1>
              <div className="mt-6 flex items-center gap-6 border-b border-slate-200 text-sm font-black text-slate-500 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("policies")}
                  className={`pb-3 transition ${
                    activeTab === "policies"
                      ? "border-b-2 border-blue-600 text-slate-950 dark:text-white"
                      : "hover:text-slate-950 dark:hover:text-white"
                  }`}
                >
                  Policies
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fields")}
                  className={`pb-3 transition ${
                    activeTab === "fields"
                      ? "border-b-2 border-blue-600 text-slate-950 dark:text-white"
                      : "hover:text-slate-950 dark:hover:text-white"
                  }`}
                >
                  Policy Fields
                </button>
              </div>
            </div>
            {canEditGenericPolicies ? (
              <button
                type="button"
                onClick={() => setShowCreatePolicy((current) => !current)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                + Add Custom Policy
              </button>
            ) : null}
          </div>

          <p className="max-w-5xl text-sm font-semibold leading-6 text-slate-500">
            Track policy uploads, employee acknowledgements, renewals, and framework applicability across your active compliance workspace.
            Upload required policy documents and link them back to the implementation tests that need them.
          </p>
        </header>

        {canEditGenericPolicies && showCreatePolicy ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Create Custom Policy</h2>
              <button
                type="button"
                onClick={() => setShowCreatePolicy(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <input
                value={newPolicyName}
                onChange={(event) => setNewPolicyName(event.target.value)}
                placeholder="Policy name"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
              />
              <input
                value={newPolicyDescription}
                onChange={(event) => setNewPolicyDescription(event.target.value)}
                placeholder="Description"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
              />
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                <Upload size={16} />
                Document
                <input
                  type="file"
                  className="hidden"
                  onChange={handleDocumentSelect}
                  accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xlsx,.xls"
                />
              </label>
              <button
                type="button"
                onClick={handleCreatePolicy}
                disabled={!canCreatePolicy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Create
              </button>
            </div>
            {customPolicyFields.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {customPolicyFields.map((field) => (
                  <PolicyFieldInput
                    key={field.id}
                    field={field}
                    value={newPolicyFieldValues[field.id] || ""}
                    onChange={(value) => handleNewPolicyFieldValueChange(field.id, value)}
                  />
                ))}
              </div>
            ) : null}
            {newPolicyDocument ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-sm font-bold text-blue-800">
                <span className="min-w-0 truncate">
                  Attached: {newPolicyDocument.name}
                </span>
                <button
                  type="button"
                  onClick={() => setNewPolicyDocument(null)}
                  className="rounded-md px-2 py-1 text-xs font-black text-blue-700 hover:bg-white"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-950 dark:text-white">Policy Overview</h2>
              <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                {notApplicablePolicies} not applicable
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-rose-500">{publishedPercentage}%</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Compliance Score</p>
              <p className="text-[10px] font-black text-rose-500">{publishedPercentage < 80 ? "At risk" : "On track"}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <OverviewMetric
              label="Published"
              value={`${publishedPolicies} / ${totalPolicies || 0}`}
              helper={`${publishedPercentage}% of applicable policies`}
              progress={publishedPercentage}
              accent="bg-blue-500"
            />
            <OverviewMetric
              label="Acknowledgement Coverage"
              value={`${acknowledgementPercentage}%`}
              helper={`${completedAcknowledgements} of ${assignedAcknowledgements} required acknowledgements`}
              progress={acknowledgementPercentage}
              accent="bg-violet-500"
            />
            <OverviewMetric
              label="Renewals"
              value="All current"
              helper="Nothing due in the next 30 days"
              progress={totalPolicies ? 100 : 0}
              accent="bg-emerald-500"
            />
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Workflow Pipeline</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <WorkflowStep label="Not Started" value={workflowCounts.notStarted} tone="bg-slate-400" />
              <WorkflowStep label="Draft" value={workflowCounts.draft} tone="bg-slate-500" />
              <WorkflowStep label="In Review" value={workflowCounts.inReview} tone="bg-amber-400" />
              <WorkflowStep label="Approved" value={workflowCounts.approved} tone="bg-sky-400" />
              <WorkflowStep label="Published" value={workflowCounts.published} tone="bg-blue-600" />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Frameworks</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {frameworkCards.map((framework) => (
                <button type="button" onClick={() => setActiveFramework(framework.id)} key={framework.id} className={`rounded-lg border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 dark:bg-slate-900 ${framework.id === activeFramework.id ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200 dark:border-slate-800"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{framework.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {framework.publishedCount} of {framework.applicableCount} applicable published
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-black text-rose-600">
                      {framework.percent}%
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-xs font-bold text-slate-500">
                    <div className="flex items-center justify-between">
                      <span>Published</span>
                      <span>{framework.percent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${framework.percent}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Acknowledged</span>
                      <span>{acknowledgementPercentage}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === "fields" ? "Search fields by name or type" : "Search by title or ID"}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-850 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={filterMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen((current) => !current);
                    setSortOpen(false);
                    setSettingsOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  <SlidersHorizontal size={16} />
                  Filters
                </button>
                {filterOpen ? (
                  <ToolbarMenu>
                    {[
                      ["all", "All policies"],
                      ["published", "Published"],
                      ["draft", "Draft"],
                      ["review", "In review"],
                      ["not_applicable", "Not applicable"],
                    ].map(([value, label]) => (
                      <MenuButton key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>
                        {label}
                      </MenuButton>
                    ))}
                  </ToolbarMenu>
                ) : null}
              </div>
              <div className="relative" ref={sortMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSortOpen((current) => !current);
                    setFilterOpen(false);
                    setSettingsOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  Sort by
                  <ChevronDown size={16} />
                </button>
                {sortOpen ? (
                  <ToolbarMenu>
                    {[
                      ["title", "Title"],
                      ["status", "Publishing status"],
                      ["owner", "Assigned to"],
                      ["framework", "Framework"],
                    ].map(([value, label]) => (
                      <MenuButton key={value} active={sortBy === value} onClick={() => setSortBy(value)}>
                        {label}
                      </MenuButton>
                    ))}
                  </ToolbarMenu>
                ) : null}
              </div>
              <div className="relative" ref={settingsMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen((current) => !current);
                    setFilterOpen(false);
                    setSortOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  <Settings size={16} />
                  Settings
                </button>
                {settingsOpen ? (
                  <ToolbarMenu>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={compactRows} onChange={(event) => setCompactRows(event.target.checked)} />
                      Compact rows
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                      <input type="checkbox" checked={showFrameworkColumn} onChange={(event) => setShowFrameworkColumn(event.target.checked)} />
                      Show frameworks
                    </label>
                  </ToolbarMenu>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Grid split layout for Table + Right Drawer */}
        {activeTab === "fields" ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Policy Fields</h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                    Manage the fields used to structure policy records for {activeFramework.shortName || activeFramework.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateField((current) => !current)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  + Add Field
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <FieldStat label="Total fields" value={policyFields.length} />
                <FieldStat label="Required" value={policyFields.filter((field) => field.required).length} />
                <FieldStat label="Custom" value={policyFields.filter((field) => !field.system).length} />
              </div>
            </div>

            {showCreateField ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
                  <input
                    value={newFieldLabel}
                    onChange={(event) => setNewFieldLabel(event.target.value)}
                    placeholder="Field name"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  />
                  <select
                    value={newFieldType}
                    onChange={(event) => setNewFieldType(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-blue-500"
                  >
                    {["Text", "Status", "Date", "People", "Number", "File", "Multi-select"].map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700">
                    <input
                      type="checkbox"
                      checked={newFieldRequired}
                      onChange={(event) => setNewFieldRequired(event.target.checked)}
                    />
                    Required
                  </label>
                  <button
                    type="button"
                    onClick={handleCreateField}
                    disabled={!newFieldLabel.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Create Field
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <table className="w-full border-collapse text-left text-sm text-slate-600">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900/50">
                    <th className="px-6 py-4">Field</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Required</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPolicyFields.map((field) => (
                    <tr key={field.id} className="transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-black text-slate-950 dark:text-white">{field.label}</td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{field.type}</span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleFieldRequired(field.id)}
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            field.required ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {field.required ? "Required" : "Optional"}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-500">{field.system ? "System" : "Custom"}</td>
                      <td className="max-w-md px-6 py-4 font-semibold text-slate-500">{field.description}</td>
                      <td className="px-6 py-4 text-right">
                        {field.system ? (
                          <span className="text-xs font-black text-slate-400">Locked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteField(field.id)}
                            className="rounded-lg border border-rose-100 px-3 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredPolicyFields.length ? (
                <div className="px-6 py-10 text-center text-sm font-bold text-slate-500">
                  No policy fields match the current search.
                </div>
              ) : null}
            </div>
          </section>
        ) : (
        <section className={`grid gap-4 items-start ${selectedPolicy ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "xl:grid-cols-1"}`}>
          {/* Policies Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-xs font-black uppercase tracking-wider text-slate-500 dark:bg-slate-900/50">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Publishing Status</th>
                  <th className="px-6 py-4">Acknowledged</th>
                  <th className="px-6 py-4">Next Version</th>
                  <th className="px-6 py-4">Reviewers</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Renewal Frequency</th>
                  {showFrameworkColumn ? <th className="px-6 py-4">Frameworks</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPolicies.map((p) => {
                  const isSelected = selectedPolicyId === p.id;
                  const isNotApplicable = p.status === "not_applicable" || p.status === "Not Applicable";
                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleSelectPolicy(p.id)}
                      className={`cursor-pointer transition hover:bg-slate-50/50 ${
                        isSelected ? "bg-blue-50/20 dark:bg-slate-800/30" : ""
                      }`}
                    >
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-bold text-slate-950 dark:text-white`}>
                        {p.title}
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"}`}>
                        <span className={`inline-flex items-center gap-1 font-bold ${
                          isNotApplicable ? "text-slate-400" : "text-blue-600"
                        }`}>
                          {isNotApplicable ? "Not Applicable" : p.status}
                          <ChevronDown size={14} />
                        </span>
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-bold text-slate-800`}>
                        {isNotApplicable ? "Not required" : p.acknowledged}
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-semibold text-slate-400`}>
                        {p.nextVersion}
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-semibold text-slate-400`}>
                        {p.reviewers}
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"}`}>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 uppercase">
                            {(p.assignedTo || "U")[0]}
                          </span>
                          <span className="font-semibold text-slate-800">{p.assignedTo}</span>
                        </div>
                      </td>
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-semibold text-slate-400`}>
                        {p.renewalFrequency}
                      </td>
                      {showFrameworkColumn ? (
                      <td className={`${compactRows ? "px-6 py-3" : "px-6 py-4"} font-bold text-slate-800`}>
                        {p.frameworks}
                      </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredPolicies.length ? (
              <div className="px-6 py-10 text-center text-sm font-bold text-slate-500">
                No policies match the current search and filters.
              </div>
            ) : null}
          </div>

          {/* Right Policy Drawer */}
          {selectedPolicy && (
            <aside className="sticky top-24 max-h-[calc(100vh-7rem)] min-w-0 space-y-6 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-950 dark:text-white">
                    {selectedPolicy.title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-400" />
                    {selectedPolicy.status === "not_applicable" || selectedPolicy.status === "Not Applicable" || selectedPolicy.acknowledged === "Not required"
                      ? "ACKNOWLEDGEMENT NOT REQUIRED"
                      : `${selectedPolicy.acknowledged} ACKNOWLEDGED`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDrawer}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              {canPublish ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handlePublish(selectedPolicy.id)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                    >
                      Publish
                    </button>
                    {!isCMMCWorkspace ? <button
                      type="button"
                      onClick={() => {
                        handleArchivePolicy(selectedPolicy.id);
                        handleCloseDrawer();
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      Archive
                    </button> : null}
                  </div>
                  {!isCMMCWorkspace ? <>
                  <input
                    value={selectedPolicy.policy.name}
                    onChange={(event) => updatePolicyField(selectedPolicy.id, { name: event.target.value })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 outline-none"
                  />
                  <textarea
                    value={selectedPolicy.policy.description}
                    onChange={(event) => updatePolicyField(selectedPolicy.id, { description: event.target.value })}
                    className="min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={selectedPolicy.policy.version}
                      onChange={(event) => updatePolicyField(selectedPolicy.id, { version: event.target.value })}
                      placeholder="Version"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                    />
                    <input
                      value={selectedPolicy.policy.owner}
                      onChange={(event) => updatePolicyField(selectedPolicy.id, { owner: event.target.value })}
                      placeholder="Owner"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                    />
                    <input
                      type="date"
                      value={selectedPolicy.policy.effectiveDate}
                      onChange={(event) => updatePolicyField(selectedPolicy.id, { effectiveDate: event.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                    />
                    <input
                      type="date"
                      value={selectedPolicy.policy.reviewDate}
                      onChange={(event) => updatePolicyField(selectedPolicy.id, { reviewDate: event.target.value })}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>
                  </> : null}
                </div>
              ) : null}

              {/* Amber Info Box (only display if status is Published - Legacy) */}
              {selectedPolicy.status === "Published - Legacy" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                    <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black">This policy uses the legacy flow</h4>
                      <p className="mt-1 text-xs leading-5 text-amber-700/90 dark:text-amber-400/90">
                        Previously uploaded evidence and prior acknowledgements are shown below in read-only mode. Please archive this previously accepted policy before authoring future versions in the updated Policy system. The archived policy will still be available for your review under Version History when you open Full View of this policy entity.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleArchive(selectedPolicy.id)}
                    type="button"
                    className="w-full rounded-lg bg-slate-900 py-2 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
                  >
                    Archive Current Policy
                  </button>
                </div>
              )}

              {/* Details Section */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Details</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Version</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.policy.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Owner</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.policy.owner}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Effective Date</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.policy.effectiveDate || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Review Date</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.policy.reviewDate || "-"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Active Frameworks</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.frameworks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold">Other Frameworks</span>
                    <span className="font-bold text-slate-850 dark:text-white">{selectedPolicy.otherFrameworks}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Tags</span>
                    <div className="flex gap-1">
                      {selectedPolicy.tags.map((tag) => (
                        <span key={tag} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs font-semibold text-slate-600">
                <div className="flex justify-between">
                  <span>Assigned</span>
                  <span className="font-black">{selectedPolicy.metrics.assigned}</span>
                </div>
                <div className="flex justify-between">
                  <span>Acknowledged</span>
                  <span className="font-black">{selectedPolicy.metrics.acknowledged}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending</span>
                  <span className="font-black">{selectedPolicy.metrics.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span>Completion</span>
                  <span className="font-black">{selectedPolicy.metrics.percentage}%</span>
                </div>
              </div>

              {customPolicyFields.length ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Policy Fields</h4>
                  <div className="grid gap-3">
                    {customPolicyFields.map((field) => (
                      <PolicyFieldInput
                        key={field.id}
                        field={field}
                        value={selectedPolicy.policy.customFieldValues?.[field.id] || ""}
                        onChange={(value) => handleSelectedPolicyFieldValueChange(field.id, value)}
                        disabled={!canEditGenericPolicies}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedPolicy.policy.versionHistory?.length ? (
                <details className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-slate-500">
                    Version History
                  </summary>
                  <div className="mt-2 space-y-2">
                    {selectedPolicy.policy.versionHistory.map((version) => (
                      <div key={version.id} className="rounded bg-white p-2 text-xs font-semibold text-slate-600">
                        v{version.version} · {version.name} · {version.archivedAt ? new Date(version.archivedAt).toLocaleDateString() : "-"}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {/* Uploaded Policy Documents */}
              {selectedPolicy.documentName || canEditGenericPolicies ? (
                <div className="min-w-0 space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Uploaded Policy Documents</h4>
                  {selectedPolicy.documentName ? (
                  <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <button type="button" onClick={openSelectedPolicyDocument} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="rounded bg-blue-50 p-2 text-blue-600">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900 dark:text-white" title={selectedPolicy.documentName}>{selectedPolicy.documentName}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{selectedPolicy.documentDate}</p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={openSelectedPolicyDocument} className="rounded-md p-2 text-slate-400 hover:bg-white hover:text-blue-700" aria-label="Open policy document"><ExternalLink size={16} /></button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPolicy(selectedPolicy)}
                      className="rounded-md p-2 text-slate-400 hover:bg-white hover:text-slate-700"
                      aria-label="Download policy document"
                    >
                      <Download size={16} />
                    </button>
                    {canEditGenericPolicies ? <button type="button" onClick={handleDeleteSelectedPolicyDocument} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label="Delete policy document"><Trash2 size={16} /></button> : null}
                    </div>
                  </div>
                  ) : <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs font-bold text-slate-500">No policy document uploaded.</p>}
                  {canEditGenericPolicies ? (
                    <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50">
                      <Upload size={15} />
                      {selectedPolicy.documentName ? "Replace document" : "Upload document"}
                      <input type="file" className="hidden" onChange={handleSelectedPolicyDocument} accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {/* Employee Acknowledgements */}
              {selectedPolicy.acknowledgements.length > 0 && selectedPolicy.status !== "not_applicable" && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {canEditGenericPolicies ? "Employee Assignments & Acknowledgements" : "My Acknowledgement"}
                  </h4>
                  <div className="grid gap-2">
                    {(canEditGenericPolicies ? employees : selectedPolicy.acknowledgements).map((item) => {
                      const employee = canEditGenericPolicies ? item : employees.find((candidate) => candidate.id === item.id) || item;
                      const isAssigned = (policyAssignments[selectedPolicy.id] || []).includes(employee.id);
                      const ack = selectedPolicy.acknowledgements.find((candidate) => candidate.id === employee.id) || {
                        id: employee.id,
                        name: employee.name,
                        status: "Pending",
                      };

                      return (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 p-2 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-100/50 select-none dark:border-slate-800"
                      >
                        <div className="flex items-center gap-2.5">
                          {canEditGenericPolicies ? (
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => handleAssignmentToggle(selectedPolicy.id, employee.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600"
                            />
                          ) : null}
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            ack.status === "Completed" ? "bg-emerald-500" : "bg-rose-500"
                          }`} />
                          <span>{ack.name}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!isAssigned}
                          onClick={() => handleToggleAcknowledgement(selectedPolicy.id, employee.id)}
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded disabled:opacity-40 ${
                            ack.status === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {ack.status === "Completed" ? "Acknowledged" : "Acknowledge"}
                        </button>
                      </div>
                    );
                    })}
                  </div>
                </div>
              )}

              {/* Connected Tests */}
              {selectedPolicy.connectedTests.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Connected Tests</h4>
                  <div className="space-y-2">
                    {selectedPolicy.connectedTests.map((t) => (
                      <button
                        type="button"
                        key={t.id || t.title}
                        onClick={() => openImplementationRecord(t.id, isCMMCWorkspace ? "Control" : "Test")}
                        className="w-full rounded-lg border border-slate-150 p-4 text-left space-y-3 bg-[#fffdf8]/30 transition hover:bg-blue-50/40 dark:border-slate-800"
                      >
                        <p className="text-sm font-bold text-slate-900 leading-relaxed">{t.description || t.title}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-600 uppercase">
                              {(t.owner || "U")[0]}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">{t.owner}</span>
                          </div>
                          <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-black text-blue-700">
                            {t.status}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!isCMMCWorkspace ? (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  onClick={() => handleToggleApplicability(selectedPolicy.id)}
                  className="text-xs font-black text-slate-400 hover:text-slate-600 hover:underline"
                >
                  {selectedPolicy.status === "not_applicable" || selectedPolicy.status === "Not Applicable"
                    ? "Mark as Applicable"
                    : "Mark as Not Applicable"}
                </button>
              </div>
              ) : null}
            </aside>
          )}
        </section>
        )}
      </div>
    </AppShell>
  );
}

function OverviewMetric({ label, value, helper, progress = 0, accent }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${accent}`} style={{ width: `${safeProgress}%` }} />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
  );
}

function WorkflowStep({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone}`} />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function FieldStat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function PolicyFieldInput({ field, value, onChange, disabled = false }) {
  const commonClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400";
  const normalizedValue = value ?? "";

  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-400">
        {field.label}
        {field.required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {field.type === "Status" || field.type === "Multi-select" ? (
        <select
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={commonClass}
        >
          <option value="">Select</option>
          <option value="Draft">Draft</option>
          <option value="In Review">In Review</option>
          <option value="Approved">Approved</option>
          <option value="Published">Published</option>
        </select>
      ) : (
        <input
          type={field.type === "Date" ? "date" : field.type === "Number" ? "number" : "text"}
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={field.type === "File" ? "Document reference or URL" : field.label}
          className={commonClass}
        />
      )}
      {field.description ? (
        <span className="mt-1 block text-xs font-semibold text-slate-400">{field.description}</span>
      ) : null}
    </label>
  );
}

function ToolbarMenu({ children }) {
  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950">
      {children}
    </div>
  );
}

function MenuButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition ${
        active
          ? "bg-blue-50 text-blue-700"
          : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900"
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

function buildCMMCPolicyPageRow(row, activeFramework, storedPolicy) {
  const frameworkName = activeFramework?.shortName || activeFramework?.name || "CMMC";
  const owner = row.ownerCollector || "Unassigned";
  const title = row.controlId || row.key || "";
  const description = row.evidence || row.requirement || "";
  const document = storedPolicy?.document || buildDefaultPolicyDocument({
    title,
    description,
    relatedControls: [row.controlId].filter(Boolean),
  }, frameworkName);

  return {
    id: row.key,
    title,
    description,
    status: row.policyStatus,
    acknowledged: "Not required",
    nextVersion: "",
    reviewers: "",
    assignedTo: owner,
    renewalFrequency: row.dateCollected || "",
    frameworks: frameworkName,
    otherFrameworks: "",
    tags: [row.domain].filter(Boolean),
    documentName: document.name,
    documentDate: document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : "",
    acknowledgements: [],
    metrics: {
      assigned: 0,
      acknowledged: 0,
      pending: 0,
      percentage: 0,
    },
    policy: {
      id: row.key,
      name: title,
      description,
      version: "",
      owner: row.ownerCollector || "",
      effectiveDate: row.dateCollected || "",
      reviewDate: "",
      versionHistory: [],
      document,
      sourcePolicy: row,
    },
    connectedTests: [],
  };
}

function cmmcRowToLibraryPolicy(row) {
  return {
    id: row.key,
    title: row.title || row.key,
    description: row.description || row.requirement || "",
    status: row.policyStatus,
    linkedControls: row.linkedControls || [],
    linkedTests: [],
    controlRequirement: row.requirement,
    controlFamily: `${row.domain} - ${row.family}`,
    evidenceRequests: row.evidenceRequests || [],
    assessmentGuidance: row.publicNotesUse || "",
  };
}

function fromApiPolicy(policy, activeFramework) {
  const date = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
  const statuses = { DRAFT: "Draft", ACTIVE: "Active", ARCHIVED: "Archived" };
  const predefinedPolicyIds = new Set((getFrameworkLibrary(activeFramework.id)?.policies || []).map((item) => item.id));
  const sourcePolicy = (getFrameworkLibrary(activeFramework.id)?.policies || []).find((item) => item.id === policy.sourcePolicyId);
  const defaultDocument = buildDefaultPolicyDocument({
    title: policy.name,
    name: policy.name,
    description: policy.description || sourcePolicy?.description || "",
    relatedControls: sourcePolicy?.relatedControls || sourcePolicy?.linkedControls || [],
  }, activeFramework.shortName || activeFramework.name);
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description || "",
    relatedFrameworks: [activeFramework.shortName || activeFramework.name],
    version: policy.versionLabel || "1.0",
    apiVersion: policy.version,
    owner: policy.ownerName || "Unassigned",
    effectiveDate: date(policy.effectiveDate),
    reviewDate: date(policy.reviewDate),
    customFieldValues: policy.customFieldValues || {},
    document: policy.document || defaultDocument,
    status: statuses[policy.status] || "Draft",
    requireReacknowledgement: policy.requireReacknowledgement ?? true,
    versionHistory: Array.isArray(policy.versionHistory) ? policy.versionHistory : [],
    custom: policy.custom ?? !predefinedPolicyIds.has(policy.id),
    apiAssignments: policy.assignments || [],
  };
}

function policyUpdatesForApi(updates) {
  const result = {};
  if (updates.name !== undefined) result.name = updates.name;
  if (updates.description !== undefined) result.description = updates.description;
  if (updates.owner !== undefined) result.ownerName = updates.owner;
  if (updates.version !== undefined) result.versionLabel = updates.version;
  if (updates.effectiveDate !== undefined) result.effectiveDate = policyDateToIso(updates.effectiveDate);
  if (updates.reviewDate !== undefined) result.reviewDate = policyDateToIso(updates.reviewDate);
  if (updates.status !== undefined) result.status = { Draft: "DRAFT", Active: "ACTIVE", Archived: "ARCHIVED" }[updates.status] || updates.status;
  if (updates.document !== undefined) result.document = updates.document;
  if (updates.customFieldValues !== undefined) result.customFieldValues = updates.customFieldValues;
  if (updates.versionHistory !== undefined) result.versionHistory = updates.versionHistory;
  if (updates.requireReacknowledgement !== undefined) result.requireReacknowledgement = updates.requireReacknowledgement;
  return result;
}

function policyDateToIso(value) {
  return value && value !== "-" ? new Date(`${value}T00:00:00Z`).toISOString() : null;
}

function loadPolicyFields(frameworkId) {
  const savedFields = readScopedJson(policyFieldsStorageKey(frameworkId), []);
  const savedById = new Map(savedFields.map((field) => [field.id, field]));
  const mergedDefaults = DEFAULT_POLICY_FIELDS.map((field) => ({
    ...field,
    required: savedById.get(field.id)?.required ?? field.required,
  }));
  const customFields = savedFields.filter((field) => !field.system);

  return [...mergedDefaults, ...customFields];
}

function policyFieldsStorageKey(frameworkId) {
  return `${POLICY_FIELDS_KEY}:${frameworkId || "default"}`;
}

function getMappedPolicyCount(frameworkId) {
  const library = getFrameworkLibrary(frameworkId);
  if (!library) return 0;
  if (library.policies?.length) return library.policies.length;
  if (resolveFrameworkId(frameworkId) === CMMC_FRAMEWORK_ID) {
    return (library.mappings || []).reduce(
      (total, mapping) => total + (mapping.evidenceRequirementIds || mapping.evidenceIds || []).length,
      0
    );
  }
  return 0;
}
