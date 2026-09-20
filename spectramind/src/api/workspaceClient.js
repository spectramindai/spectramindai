// Session-scoped cache and serial writes. Conflicts stop queued edits; never auto-retry a stale overwrite.
export function createWorkspaceClient({ request, getSession, onSaved = () => {} }) {
  const workspaces = new Map();
  const sessionKey = () => { const session = getSession(); return session?.token && session?.organizationId ? `${session.token}:${session.organizationId}` : ''; };
  const context = frameworkId => {
    const session = sessionKey();
    if (!session) throw new Error('Sign in before loading or saving workspace data.');
    const key = `${session}:${frameworkId}`;
    if (!workspaces.has(key)) workspaces.set(key, { rows: {}, queues: new Map(), loading: null });
    return { session, workspace: workspaces.get(key), assertSession: () => { if (sessionKey() !== session) throw new Error('Your session changed. Reopen the workspace.'); } };
  };
  async function load(frameworkId) {
    const ctx = context(frameworkId);
    const workspace = ctx.workspace;
    await Promise.all([...workspace.queues.values()].map(entry => entry.tail.catch(() => {})));
    ctx.assertSession();
    if (!workspace.loading) {
      workspace.loading = request(`/api/v1/workspace?frameworkId=${encodeURIComponent(frameworkId)}`)
        .then(rows => { ctx.assertSession(); workspace.rows = rows; return rows; })
        .finally(() => { workspace.loading = null; });
    }
    return workspace.loading;
  }
  function save(frameworkId, itemId, state, version, itemType) {
    let ctx;
    try { ctx = context(frameworkId); } catch (error) { return Promise.reject(error); }
    const workspace = ctx.workspace;
    let entry = workspace.queues.get(itemId);
    if (!entry) {
      const saved = workspace.rows[itemId];
      entry = { saved, visible: saved || {}, tail: Promise.resolve(), pending: 0, error: null };
      workspace.queues.set(itemId, entry);
    }
    if (!entry.pending) { entry.saved = workspace.rows[itemId]; entry.visible = entry.saved || {}; entry.error = null; }
    if (!entry.pending && version !== undefined && entry.saved && version !== entry.saved.apiVersion) return Promise.reject(new Error('This record changed. Reload and review before saving.'));
    const patch = changedFields(entry.visible, state);
    entry.visible = mergeFields(entry.visible, state);
    entry.pending += 1;
    const task = entry.tail.then(async () => {
      ctx.assertSession();
      if (entry.error) throw entry.error;
      if (!entry.saved) {
        const rows = await request(`/api/v1/workspace?frameworkId=${encodeURIComponent(frameworkId)}`);
        ctx.assertSession();
        entry.saved = rows[itemId] || { apiVersion: 0 };
      }
      if (!Object.keys(patch).length) return entry.saved;
      const saved = await request(`/api/v1/workspace/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify({ frameworkId, itemType, state: patch, version: entry.saved.apiVersion ?? 0 }) });
      ctx.assertSession();
      entry.saved = saved;
      workspace.rows[itemId] = saved;
      onSaved();
      return saved;
    }).catch(error => { entry.error = error; throw error; }).finally(() => { entry.pending -= 1; });
    // Keep a rejection handler on the sequencing promise without swallowing the caller's error.
    entry.tail = task.catch(() => {});
    return task;
  }
  return { load, save };
}

const metadata = new Set(['apiVersion', 'apiItemType', 'apiDeclaredStatus', 'evidenceIncomplete', '__proto__', 'constructor', 'prototype']);
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function changedFields(previous = {}, next = {}) {
  const patch = {};
  for (const [key, value] of Object.entries(next)) {
    if (metadata.has(key)) continue;
    if (record(value) && record(previous[key])) {
      const nested = changedFields(previous[key], value);
      if (Object.keys(nested).length) patch[key] = nested;
    } else if (JSON.stringify(previous[key]) !== JSON.stringify(value)) patch[key] = value;
  }
  return patch;
}
function mergeFields(previous, next) {
  const result = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    if (metadata.has(key)) continue;
    result[key] = record(value) && record(previous[key]) ? mergeFields(previous[key], value) : value;
  }
  return result;
}
