import { getOrganizationScopedStorageKey } from "../auth/session";
import { DEFAULT_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

const STORAGE_KEY = "spectramind:organization-workspace";

export function loadOrganizationWorkspace(frameworkId = null) {
  if (typeof window === "undefined") return {};

  try {
    const workspace = JSON.parse(window.localStorage.getItem(getOrganizationScopedStorageKey(STORAGE_KEY)) || "{}");
    return frameworkId ? createFrameworkWorkspaceView(workspace, frameworkId) : workspace;
  } catch {
    return {};
  }
}

export function saveOrganizationWorkspace(workspaceData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getOrganizationScopedStorageKey(STORAGE_KEY), JSON.stringify(workspaceData));
  window.dispatchEvent(new Event("spectramind:workspace-updated"));
}

function createFrameworkWorkspaceView(workspace, frameworkId) {
  const resolvedFrameworkId = resolveFrameworkId(frameworkId) || frameworkId;

  if (resolvedFrameworkId === DEFAULT_FRAMEWORK_ID) {
    return Object.fromEntries(Object.entries(workspace).filter(([key]) => !key.includes(":")));
  }

  const prefix = `${resolvedFrameworkId}:`;
  return Object.fromEntries(
    Object.entries(workspace)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
}
