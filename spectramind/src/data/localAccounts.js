const ACCOUNTS_KEY = "spectramind:local-accounts";
const ORGANIZATIONS_KEY = "spectramind:local-organizations";
const INVITATIONS_KEY = "spectramind:local-invitations";
const PASSWORD_RESETS_KEY = "spectramind:local-password-resets";

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event("spectramind:local-directory-updated"));
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export async function registerLocalAccount(account, password) {
  const email = normalizeEmail(account.email);
  const accounts = read(ACCOUNTS_KEY);
  if (accounts.some((item) => normalizeEmail(item.email) === email)) throw new Error("An account already exists for this email.");
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(password, passwordSalt);
  write(ACCOUNTS_KEY, [...accounts, { ...account, email, passwordSalt, passwordHash, createdAt: new Date().toISOString() }]);
}

export function findLocalAccount(email) {
  const normalizedEmail = normalizeEmail(email);
  return read(ACCOUNTS_KEY).find((item) => normalizeEmail(item.email) === normalizedEmail) || null;
}

export async function authenticateLocalAccount(email, password) {
  const account = findLocalAccount(email);
  if (!account) return { account: null, valid: false, reason: "USER_NOT_FOUND" };
  if (!account.passwordHash || !account.passwordSalt) return { account, valid: false, reason: "PASSWORD_NOT_CONFIGURED" };
  const candidateHash = await hashPassword(password, account.passwordSalt);
  return { account, valid: candidateHash === account.passwordHash, reason: candidateHash === account.passwordHash ? "" : "INVALID_PASSWORD" };
}

export function updateLocalAccount(email, updates) {
  const normalizedEmail = normalizeEmail(email);
  const accounts = read(ACCOUNTS_KEY);
  write(ACCOUNTS_KEY, accounts.map((account) => normalizeEmail(account.email) === normalizedEmail ? { ...account, ...updates, email: normalizedEmail } : account));
}

export function createLocalPasswordReset(email) {
  const account = findLocalAccount(email);
  if (!account) return null;
  const token = crypto.randomUUID();
  const resets = read(PASSWORD_RESETS_KEY).filter(item => item.email !== account.email && item.expiresAt > Date.now());
  write(PASSWORD_RESETS_KEY, [...resets, { token, email: account.email, expiresAt: Date.now() + 30 * 60 * 1000 }]);
  return token;
}

export async function resetLocalAccountPassword(token, password) {
  const resets = read(PASSWORD_RESETS_KEY);
  const reset = resets.find(item => item.token === token && item.expiresAt > Date.now());
  if (!reset) return false;
  const passwordSalt = createSalt();
  const passwordHash = await hashPassword(password, passwordSalt);
  updateLocalAccount(reset.email, { passwordSalt, passwordHash, passwordUpdatedAt: new Date().toISOString() });
  write(PASSWORD_RESETS_KEY, resets.filter(item => item.token !== token));
  return true;
}

export function createLocalOrganization({ id, name, contactEmail, ownerEmail }) {
  const organizations = read(ORGANIZATIONS_KEY);
  const normalizedName = name.trim().toLowerCase();
  if (organizations.some((item) => item.name.trim().toLowerCase() === normalizedName)) throw new Error("An organization with this name already exists.");
  if (organizations.some((item) => normalizeEmail(item.ownerEmail) === normalizeEmail(ownerEmail))) throw new Error("This account already owns an organization.");
  const organization = { id, name: name.trim(), contactEmail: normalizeEmail(contactEmail), ownerEmail: normalizeEmail(ownerEmail), createdAt: new Date().toISOString() };
  write(ORGANIZATIONS_KEY, [...organizations, organization]);
  return organization;
}

export function createLocalInvitations({ emails, role, organizationId, organizationName, invitedBy }) {
  const invitations = read(INVITATIONS_KEY);
  const created = emails.map((email) => {
    const normalizedEmail = normalizeEmail(email);
    const existing = invitations.find((item) => normalizeEmail(item.email) === normalizedEmail && item.organizationId === organizationId && item.status === "pending");
    if (existing) return existing;
    return { token: crypto.randomUUID(), email: normalizedEmail, role, organizationId, organizationName, invitedBy, status: "pending", createdAt: new Date().toISOString() };
  });
  const newTokens = new Set(created.map((item) => item.token));
  write(INVITATIONS_KEY, [...invitations.filter((item) => !newTokens.has(item.token)), ...created.filter((item) => !invitations.some((old) => old.token === item.token))]);
  return created;
}

export function findLocalInvitations(email) {
  const normalizedEmail = normalizeEmail(email);
  return read(INVITATIONS_KEY).filter((item) => normalizeEmail(item.email) === normalizedEmail && item.status === "pending");
}

export function findLocalInvitationByToken(token) {
  return read(INVITATIONS_KEY).find((item) => item.token === token && item.status === "pending") || null;
}

export function acceptLocalInvitation(token) {
  const invitations = read(INVITATIONS_KEY);
  const invitation = invitations.find((item) => item.token === token && item.status === "pending");
  if (!invitation) throw new Error("This invitation is invalid or has already been accepted.");
  write(INVITATIONS_KEY, invitations.map((item) => item.token === token ? { ...item, status: "accepted", acceptedAt: new Date().toISOString() } : item));
  return invitation;
}

export function revokeLocalInvitation({ email, organizationId }) {
  const normalizedEmail = normalizeEmail(email);
  const invitations = read(INVITATIONS_KEY);
  const matching = invitations.filter((item) => normalizeEmail(item.email) === normalizedEmail && item.organizationId === organizationId && item.status === "pending");
  if (!matching.length) return false;
  const tokens = new Set(matching.map((item) => item.token));
  write(INVITATIONS_KEY, invitations.map((item) => tokens.has(item.token) ? { ...item, status: "revoked", revokedAt: new Date().toISOString() } : item));
  return true;
}

export function updateLocalOrganizationRole({ email, organizationId, role }) {
  const normalizedEmail = normalizeEmail(email);
  const invitations = read(INVITATIONS_KEY);
  write(INVITATIONS_KEY, invitations.map((invitation) =>
    normalizeEmail(invitation.email) === normalizedEmail && invitation.organizationId === organizationId && invitation.status === "pending"
      ? { ...invitation, role }
      : invitation
  ));
  const accounts = read(ACCOUNTS_KEY);
  write(ACCOUNTS_KEY, accounts.map((account) =>
    normalizeEmail(account.email) === normalizedEmail && account.organizationId === organizationId
      ? { ...account, role }
      : account
  ));
}

function createSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToBase64(bytes);
}

async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: 120000 }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
