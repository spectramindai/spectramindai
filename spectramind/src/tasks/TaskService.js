import { readScopedJson, writeScopedJson } from "../auth/session";

const TASK_STATE_KEY = "spectramind:task-state";

export const TASK_STATUSES = ["Open", "In Progress", "Completed"];

export function loadTaskState(frameworkId = "") {
  const state = readScopedJson(storageKey(frameworkId), {});
  return state && typeof state === "object" ? state : {};
}

export function saveTaskState(frameworkId = "", state) {
  writeScopedJson(storageKey(frameworkId), state || {}, { eventName: "spectramind:tasks-updated" });
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
  window.dispatchEvent(new Event("storage"));
}

export function mergeTaskState(tasks = [], taskState = {}) {
  return tasks
    .map((task) => ({
      ...task,
      ...(taskState[task.id] || {}),
      generatedStatus: task.status,
      status: taskState[task.id]?.status || task.status || "Open",
      owner: taskState[task.id]?.owner || task.owner || "Unassigned",
    }));
}

export function updateTaskState(taskState, taskId, updates) {
  return {
    ...(taskState || {}),
    [taskId]: {
      ...(taskState?.[taskId] || {}),
      ...updates,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function completeTaskState(taskState, taskId, user) {
  return updateTaskState(taskState, taskId, {
    status: "Completed",
    completedAt: new Date().toISOString(),
    completedBy: user?.name || user?.email || "User",
  });
}

function storageKey(frameworkId) {
  return frameworkId ? `${TASK_STATE_KEY}:${frameworkId}` : TASK_STATE_KEY;
}
