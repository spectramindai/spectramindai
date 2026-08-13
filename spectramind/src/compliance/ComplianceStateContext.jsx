/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useEvidenceStore } from "../core/adapters/useEvidenceStore";
import { useFrameworkData } from "../core/adapters/useFrameworkData";
import { useOrganizationStore } from "../core/adapters/useOrganizationStore";
import { useProgressData } from "../core/adapters/useProgressData";
import { useRelationshipGraph } from "../core/adapters/useRelationshipGraph";
import { loadQuestionnaireResponses } from "../data/questionnaireEngine";
import { loadAuditReviews } from "../audit/AuditReviewService";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";
import { loadTrainingSnapshot } from "../training/TrainingService";
import { loadPolicySnapshot } from "../policies/PolicyService";
import { loadRiskStore } from "../risks/RiskService";
import { completeTaskState, loadTaskState, saveTaskState, updateTaskState } from "../tasks/TaskService";
import {
  applyWorkspaceRelationshipUpdates,
  buildComplianceSnapshot,
} from "./ComplianceRelationshipService";

const ComplianceStateContext = createContext(null);

export function ComplianceStateProvider({ children }) {
  const { activeFramework } = useFrameworkWorkspace();
  const frameworkId = activeFramework?.id || "";
  const frameworkData = useFrameworkData(frameworkId);
  const relationshipGraph = useRelationshipGraph(frameworkId);
  const { workspaceData, saveWorkspaceItem } = useOrganizationStore(frameworkId);
  const evidenceStore = useEvidenceStore(frameworkId);
  const { summary: progressSummary } = useProgressData(frameworkId);
  const [questionnaireResponses, setQuestionnaireResponses] = useState(() =>
    frameworkId ? loadQuestionnaireResponses(frameworkId) : {}
  );
  const [trainingSnapshot, setTrainingSnapshot] = useState(() => loadTrainingSnapshot());
  const [policySnapshot, setPolicySnapshot] = useState(() => loadPolicySnapshot(frameworkId));
  const [riskStore, setRiskStore] = useState(() => loadRiskStore(frameworkId));
  const [auditReviews, setAuditReviews] = useState(() => loadAuditReviews(frameworkId));
  const [taskState, setTaskState] = useState(() => loadTaskState(frameworkId));

  useEffect(() => {
    const refreshQuestionnaire = () => {
      setQuestionnaireResponses(frameworkId ? loadQuestionnaireResponses(frameworkId) : {});
    };

    refreshQuestionnaire();
    window.addEventListener("spectramind:questionnaire-updated", refreshQuestionnaire);
    window.addEventListener("spectramind:active-framework-updated", refreshQuestionnaire);
    window.addEventListener("storage", refreshQuestionnaire);

    return () => {
      window.removeEventListener("spectramind:questionnaire-updated", refreshQuestionnaire);
      window.removeEventListener("spectramind:active-framework-updated", refreshQuestionnaire);
      window.removeEventListener("storage", refreshQuestionnaire);
    };
  }, [frameworkId]);

  useEffect(() => {
    const refreshTraining = () => setTrainingSnapshot(loadTrainingSnapshot());
    window.addEventListener("spectramind:training-updated", refreshTraining);
    window.addEventListener("storage", refreshTraining);
    return () => {
      window.removeEventListener("spectramind:training-updated", refreshTraining);
      window.removeEventListener("storage", refreshTraining);
    };
  }, []);

  useEffect(() => {
    const refreshPolicy = () => setPolicySnapshot(loadPolicySnapshot(frameworkId));
    refreshPolicy();
    window.addEventListener("spectramind:policy-updated", refreshPolicy);
    window.addEventListener("storage", refreshPolicy);
    return () => {
      window.removeEventListener("spectramind:policy-updated", refreshPolicy);
      window.removeEventListener("storage", refreshPolicy);
    };
  }, [frameworkId]);

  useEffect(() => {
    const refreshRiskStore = () => setRiskStore(loadRiskStore(frameworkId));
    refreshRiskStore();
    window.addEventListener("spectramind:risk-updated", refreshRiskStore);
    window.addEventListener("storage", refreshRiskStore);
    return () => {
      window.removeEventListener("spectramind:risk-updated", refreshRiskStore);
      window.removeEventListener("storage", refreshRiskStore);
    };
  }, [frameworkId]);

  useEffect(() => {
    const refreshAuditReviews = () => setAuditReviews(loadAuditReviews(frameworkId));
    refreshAuditReviews();
    window.addEventListener("spectramind:audit-updated", refreshAuditReviews);
    window.addEventListener("storage", refreshAuditReviews);
    return () => {
      window.removeEventListener("spectramind:audit-updated", refreshAuditReviews);
      window.removeEventListener("storage", refreshAuditReviews);
    };
  }, [frameworkId]);

  useEffect(() => {
    const refreshTaskState = () => setTaskState(loadTaskState(frameworkId));
    refreshTaskState();
    window.addEventListener("spectramind:tasks-updated", refreshTaskState);
    window.addEventListener("storage", refreshTaskState);
    return () => {
      window.removeEventListener("spectramind:tasks-updated", refreshTaskState);
      window.removeEventListener("storage", refreshTaskState);
    };
  }, [frameworkId]);

  const saveComplianceItem = useCallback(
    (itemId, nextState) => {
      const updates = applyWorkspaceRelationshipUpdates({
        itemId,
        nextState,
        currentWorkspace: workspaceData,
        relationshipGraph,
      });

      Object.entries(updates).forEach(([targetItemId, state]) => {
        saveWorkspaceItem(targetItemId, state);
      });
    },
    [relationshipGraph, saveWorkspaceItem, workspaceData]
  );

  const updateTask = useCallback(
    (taskId, updates) => {
      const nextState = updateTaskState(loadTaskState(frameworkId), taskId, updates);
      setTaskState(nextState);
      saveTaskState(frameworkId, nextState);
    },
    [frameworkId]
  );

  const completeTask = useCallback(
    (task) => {
      const nextState = completeTaskState(loadTaskState(frameworkId), task.id);
      setTaskState(nextState);
      saveTaskState(frameworkId, nextState);

      if (task.itemId) {
        const currentItem = workspaceData[task.itemId] || {};
        const nextItemState = {
          ...currentItem,
          status: getCompletionStatusForTask(task),
          timeline: [
            {
              id: `task-completed-${Date.now()}`,
              label: `Task completed: ${task.title}`,
              timestamp: new Date().toISOString(),
            },
            ...(currentItem.timeline || []),
          ],
        };
        saveComplianceItem(task.itemId, nextItemState);
      }
    },
    [frameworkId, saveComplianceItem, workspaceData]
  );

  const state = useMemo(
    () =>
      buildComplianceSnapshot({
        activeFramework,
        frameworkData,
        questionnaireResponses,
        workspaceData,
        evidenceRecords: evidenceStore.records,
        relationshipGraph,
        progressSummary,
        training: trainingSnapshot,
        policy: policySnapshot,
        riskStore,
        auditReviews,
        taskState,
      }),
    [activeFramework, auditReviews, evidenceStore.records, frameworkData, policySnapshot, progressSummary, questionnaireResponses, relationshipGraph, riskStore, taskState, trainingSnapshot, workspaceData]
  );

  const value = useMemo(
    () => ({
      ...state,
      activeFramework,
      frameworkData: state.implementations,
      questionnaireResponses,
      workspaceData,
      relationshipGraph,
      evidenceStore,
      progressSummary,
      training: state.training,
      policy: state.policy,
      risk: state.risk,
      actions: {
        saveComplianceItem,
        saveEvidenceRecords: evidenceStore.setRecords,
        updateTask,
        completeTask,
      },
    }),
    [
      activeFramework,
      evidenceStore,
      progressSummary,
      questionnaireResponses,
      relationshipGraph,
      saveComplianceItem,
      state,
      updateTask,
      workspaceData,
      completeTask,
    ]
  );

  return <ComplianceStateContext.Provider value={value}>{children}</ComplianceStateContext.Provider>;
}

function getCompletionStatusForTask(task) {
  if (task.category === "Risk" || task.itemType === "Risk") return "Mitigated";
  if (task.category === "Policy" || task.itemType === "Policy") return "Active";
  return "Completed";
}

export function useComplianceState() {
  const context = useContext(ComplianceStateContext);
  if (!context) {
    throw new Error("useComplianceState must be used within ComplianceStateProvider");
  }

  return context;
}
