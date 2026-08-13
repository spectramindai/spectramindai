import { ArrowRight, Building2, Mail, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { canManageWorkspace } from "../auth/session";
import { isApiEnabled, registerWithApi } from "../api/client";
import { createEmployee } from "../api/people";
import { createInvitation, createOrganization } from "../api/organizations";
import { createLocalInvitations, createLocalOrganization, registerLocalAccount, updateLocalAccount } from "../data/localAccounts";

const PENDING_SIGNUP_KEY = "spectramind:pending-signup";

export default function OrganizationSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, updateUser } = useUser();
  const pending = readPending();
  const effectiveRole = user?.role || pending?.role;
  const [organizationName, setOrganizationName] = useState("");
  const [contactEmail, setContactEmail] = useState(user?.email || pending?.email || "");
  const [invites, setInvites] = useState([{ email: "", role: "User" }]);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  if (!user && !pending) return <Navigate to="/signup" replace />;
  if (user?.onboardingComplete && user?.organizationId) return <Navigate to="/dashboard" replace />;
  if (!canManageWorkspace(effectiveRole)) return <Navigate to="/join-organization" replace />;

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      let session = user;
      if (isApiEnabled && pending) {
        session = await registerWithApi({ name: pending.name, email: pending.email, password: pending.password, role: pending.role, organizationName });
        login(session, { remember: true }); sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      } else if (isApiEnabled) {
        const organization = await createOrganization({ name: organizationName, contactEmail });
        const membership = { organizationId: organization.id, organizationName: organization.name, role: organization.role, onboardingComplete: true, organizationSetupSkipped: false };
        updateUser(membership);
        session = { ...user, ...membership };
      } else {
        const organizationId = `${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
        createLocalOrganization({ id: organizationId, name: organizationName, contactEmail, ownerEmail: user.email });
        const membership = { organizationId, organizationName: organizationName.trim(), contactEmail: contactEmail.trim(), onboardingComplete: true, organizationSetupSkipped: false };
        updateLocalAccount(user.email, membership);
        updateUser(membership);
      }
      const acceptedInvites = invites.filter((invite) => invite.email.trim()).map((invite, index) => ({ id: Date.now() + index, name: invite.email.split("@")[0], email: invite.email.trim().toLowerCase(), role: invite.role, type: "Full-Time", hasAccess: true, startDate: "-", endDate: "-", tags: ["Invited"], employeeStatus: "Invited" }));
      if (isApiEnabled && acceptedInvites.length) {
        await Promise.all(acceptedInvites.map(async (invite) => {
          await createEmployee({ name: invite.name, email: invite.email, jobRole: invite.role, accessRole: apiRole(invite.role), employmentType: invite.type, hasAccess: true, tags: invite.tags });
          await createInvitation({ email: invite.email, role: apiRole(invite.role) });
        }));
      }
      const orgId = session?.organizationId || JSON.parse(localStorage.getItem("spectramind:session") || "{}").organizationId;
      if (!isApiEnabled && orgId) {
        localStorage.setItem(`spectramind:employees:org:${orgId}`, JSON.stringify(acceptedInvites));
        createLocalInvitations({ emails: acceptedInvites.map((invite) => invite.email), role: "User", organizationId: orgId, organizationName, invitedBy: contactEmail });
      }
      navigate(canManageWorkspace(effectiveRole) ? "/frameworks" : "/dashboard", { replace: true });
    } catch (reason) { setError(reason.message || "Could not create organization."); }
    finally { setSaving(false); }
  };

  const skipForNow = async () => {
    setSaving(true); setError("");
    try {
      const skippedSetup = { organizationId: "", organizationName: "", onboardingComplete: false, organizationSetupSkipped: true };
      if (pending) {
        let session = null;
        if (isApiEnabled) {
          session = await registerWithApi({ name: pending.name, email: pending.email, password: pending.password, role: pending.role, organizationSetupSkipped: true });
        } else {
          session = { name: pending.name, email: pending.email, role: pending.role, ...skippedSetup };
          await registerLocalAccount(session, pending.password);
        }
        login({ ...session, ...skippedSetup }, { remember: true });
        sessionStorage.removeItem(PENDING_SIGNUP_KEY);
      } else if (user) {
        if (!isApiEnabled) updateLocalAccount(user.email, skippedSetup);
        updateUser(skippedSetup);
      }
      navigate("/dashboard", { replace: true });
    } catch (reason) { setError(reason.message || "Could not skip organization setup."); }
    finally { setSaving(false); }
  };

  return <main className="min-h-screen bg-[#fbfaf7] px-5 py-10 text-slate-900"><div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10"><p className="text-sm font-black uppercase tracking-widest text-blue-700">Step 2 of 3</p><div className="mt-3 flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Building2/></span><div><h1 className="text-3xl font-black">Create your organization</h1><p className="mt-2 text-slate-500">Frameworks stay locked until this workspace is created.</p></div></div>
    {location.state?.setupRequired && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">Complete your workspace setup to access compliance workspaces.</p>}
    <form onSubmit={submit} className="mt-8 space-y-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="Organization name" value={organizationName} onChange={setOrganizationName} required/><Field label="Contact email" value={contactEmail} onChange={setContactEmail} type="email" required/></div>
      <section className="rounded-xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="font-black">Invite employees</h2><p className="mt-1 text-sm text-slate-500">Invitations are saved to your employee workspace.</p></div><button type="button" onClick={() => setInvites([...invites, {email:"", role:"User"}])} className="inline-flex items-center gap-2 text-sm font-black text-blue-700"><Plus size={16}/>Add</button></div><div className="mt-4 space-y-3">{invites.map((invite,index) => <div key={index} className="flex gap-2"><div className="relative flex-1"><Mail className="absolute left-3 top-3.5 text-slate-400" size={17}/><input aria-label="Employee email" type="email" value={invite.email} onChange={(e) => setInvites(invites.map((item,i)=>i===index?{...item,email:e.target.value}:item))} placeholder="employee@company.com" className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-3"/></div><select aria-label="Employee role" value={invite.role} onChange={(e)=>setInvites(invites.map((item,i)=>i===index?{...item,role:e.target.value}:item))} className="rounded-xl border border-slate-300 px-3"><option>User</option><option>Manager</option><option>Admin</option></select><button aria-label="Remove invite" type="button" onClick={()=>setInvites(invites.filter((_,i)=>i!==index))} className="p-3 text-slate-400 hover:text-rose-600"><Trash2 size={18}/></button></div>)}</div></section>
      {!canManageWorkspace(effectiveRole) && <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">Your User role has limited access. An Admin or Manager must manage employees and frameworks after setup.</p>}{error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}<button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-black text-white">{saving ? "Creating workspace..." : canManageWorkspace(effectiveRole) ? "Create and choose frameworks" : "Create workspace"}<ArrowRight size={18}/></button><button type="button" disabled={saving} onClick={skipForNow} className="mx-auto block text-sm font-bold text-slate-500 transition hover:text-blue-700 disabled:opacity-60">Skip for now</button></form></div></main>;
}
function readPending(){try{return JSON.parse(sessionStorage.getItem(PENDING_SIGNUP_KEY)||"null");}catch{return null;}}
function apiRole(role){return role === "Admin" ? "ADMIN" : role === "Manager" ? "COMPLIANCE_MANAGER" : "EMPLOYEE";}
function Field({label,value,onChange,type="text",required}){return <label><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"/></label>}
