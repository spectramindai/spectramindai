import { apiRequest, getApiSession, persistApiSession } from "./client";

export const getCurrentOrganization = () => apiRequest("/api/v1/organizations/current");
export const updateCurrentOrganization = input => apiRequest("/api/v1/organizations/current", { method: "PATCH", body: JSON.stringify(input) });
export async function createOrganization(input) {
  const organization = await apiRequest("/api/v1/organizations", { method: "POST", body: JSON.stringify(input) });
  const session = getApiSession();
  persistApiSession({ ...session, organizationId: organization.id });
  return organization;
}
export const listMyInvitations = () => apiRequest("/api/v1/invitations/me");
export async function acceptInvitation(token) {
  const organization = await apiRequest(`/api/v1/invitations/${token}/accept`, { method: "POST" });
  const session = getApiSession();
  persistApiSession({ ...session, organizationId: organization.id });
  return organization;
}
export const createInvitation = input => apiRequest("/api/v1/invitations", { method: "POST", body: JSON.stringify(input) });
export const revokeInvitation = id => apiRequest(`/api/v1/invitations/${id}`, { method: "DELETE" });
export const changeMemberRole = (id, role) => apiRequest(`/api/v1/memberships/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
export const removeMembership = id => apiRequest(`/api/v1/memberships/${id}`, { method: "DELETE" });
