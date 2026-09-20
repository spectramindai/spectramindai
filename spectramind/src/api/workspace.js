import { apiRequest, getApiSession, isApiEnabled } from './client';
import { createWorkspaceClient } from './workspaceClient';
const client = createWorkspaceClient({ request: apiRequest, getSession: getApiSession, onSaved: () => window.dispatchEvent(new Event('spectramind:workspace-updated')) });
export const loadApiWorkspace = frameworkId => isApiEnabled ? client.load(frameworkId) : null;
export const saveApiWorkspaceItem = (frameworkId, itemId, state, version, itemType) => client.save(frameworkId, itemId, state, version, itemType);
