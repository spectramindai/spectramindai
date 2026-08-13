import { Building2, CheckCircle2, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { isApiEnabled } from "../api/client";
import { acceptInvitation, listMyInvitations } from "../api/organizations";
import { useUser } from "../auth/UserContext";
import { acceptLocalInvitation, findLocalInvitationByToken, findLocalInvitations, updateLocalAccount } from "../data/localAccounts";

export default function JoinOrganization() {
  const { user, updateUser, logout } = useUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [apiInvitations, setApiInvitations] = useState([]);
  const localInvitations = useMemo(() => {
    const tokenInvitation = findLocalInvitationByToken(params.get("token"));
    if (tokenInvitation && tokenInvitation.email.toLowerCase() === user?.email?.toLowerCase()) return [tokenInvitation];
    return findLocalInvitations(user?.email);
  }, [params, user?.email]);
  const invitations = isApiEnabled ? apiInvitations : localInvitations;

  useEffect(() => {
    if (!isApiEnabled || !user) return;
    listMyInvitations().then(setApiInvitations).catch(reason => setError(reason.message));
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.onboardingComplete) return <Navigate to="/dashboard" replace />;

  const join = async invitation => {
    try {
      if (isApiEnabled) {
        const organization = await acceptInvitation(invitation.token);
        updateUser({ organizationId: organization.id, organizationName: organization.name, role: displayRole(organization.role), onboardingComplete: true });
      } else {
        acceptLocalInvitation(invitation.token);
        const membership = { organizationId: invitation.organizationId, organizationName: invitation.organizationName, role: invitation.role, onboardingComplete: true };
        updateLocalAccount(user.email, membership);
        updateUser(membership);
      }
      navigate("/dashboard", { replace: true });
    } catch (reason) { setError(reason.message); }
  };

  return <main className="min-h-screen bg-[#fbfaf7] px-5 py-12"><div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"><Building2 size={40} className="text-blue-700"/><h1 className="mt-5 text-3xl font-black text-slate-950">Join an organization</h1><p className="mt-2 text-slate-500">Invitations sent to <strong>{user.email}</strong> appear here.</p>{error && <p className="mt-5 rounded-lg bg-rose-50 p-3 text-rose-700">{error}</p>}<div className="mt-7 space-y-4">{invitations.length ? invitations.map(invitation => <article key={invitation.token} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-5"><div><h2 className="font-black text-slate-950">{invitation.organizationName || invitation.organization?.name}</h2><p className="mt-1 text-sm text-slate-500">Invited as {displayRole(invitation.role)}{typeof invitation.invitedBy === "string" && invitation.invitedBy.includes("@") ? ` by ${invitation.invitedBy}` : ""}</p></div><button onClick={() => join(invitation)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-bold text-white"><CheckCircle2 size={17}/>Join</button></article>) : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><p className="font-bold text-slate-700">No pending invitation found.</p><p className="mt-2 text-sm text-slate-500">Ask an Admin or Manager to invite this exact email address.</p></div>}</div><div className="mt-6 border-t border-slate-200 pt-5"><button onClick={() => { logout(); navigate("/login", { replace: true }); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-50"><LogOut size={17}/>Sign out and use another account</button></div></div></main>;
}

function displayRole(role) { return role === "EMPLOYEE" ? "User" : role === "COMPLIANCE_MANAGER" ? "Manager" : role === "ADMIN" || role === "OWNER" ? "Admin" : role; }
