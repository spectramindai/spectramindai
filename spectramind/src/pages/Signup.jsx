import { ArrowLeft, ArrowRight, Check, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { isApiEnabled, registerWithApi } from "../api/client";
import { APP_NAME } from "../core/adapters/useOrganizationBranding";
import { findLocalInvitations, registerLocalAccount } from "../data/localAccounts";

const roles = [
  { value: "Admin", title: "Admin", text: "Full workspace, people, settings, and framework access." },
  { value: "Manager", title: "Manager", text: "Same workspace access as an admin." },
  { value: "User", title: "User", text: "Limited access to assigned compliance work." },
];

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useUser();
  const [form, setForm] = useState({ name: location.state?.name || "", email: location.state?.email || "", password: "", confirmPassword: "", role: "Admin" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (form.password.length < 12) return setError("Use at least 12 characters for your password.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setSubmitting(true); setError("");
    try {
      if (isApiEnabled) {
        const account = await registerWithApi({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role });
        login(account, { remember: true });
        navigate(form.role === "User" ? "/join-organization" : "/onboarding/organization");
      } else {
        const pendingInvitations = findLocalInvitations(form.email);
        const assignedRole = pendingInvitations[0]?.role || form.role;
        const account = { name: form.name.trim(), email: form.email.trim().toLowerCase(), role: assignedRole, onboardingComplete: false };
        await registerLocalAccount(account, form.password);
        login(account, { remember: true });
        navigate(pendingInvitations.length || assignedRole === "User" ? "/join-organization" : "/onboarding/organization");
      }
    } catch (reason) { setError(reason.message || "Account creation failed."); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="min-h-screen bg-[#fbfaf7] px-5 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col">
          <Link to="/" className="flex items-center gap-3 text-xl font-black"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-500 text-slate-950">S</span>{APP_NAME}</Link>
          <div className="my-auto">
            <ShieldCheck className="text-amber-400" size={42} />
            <h1 className="mt-6 text-4xl font-black leading-tight">Build your compliance workspace.</h1>
            <p className="mt-4 leading-7 text-slate-300">Create your account, set up your organization, invite employees, then choose the frameworks your team needs.</p>
            <ol className="mt-8 space-y-4 text-sm font-semibold text-slate-200">
              {["Create your personal account", "Configure your organization", "Invite employees", "Select compliance frameworks"].map((item, index) => <li key={item} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10">{index + 1}</span>{item}</li>)}
            </ol>
          </div>
        </section>
        <section className="p-6 sm:p-10">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-700"><ArrowLeft size={16}/>Back to sign in</Link>
          <div className="mt-8"><p className="text-sm font-black uppercase tracking-widest text-blue-700">Step 1 of 3</p><h2 className="mt-2 text-4xl font-black">Create your account</h2><p className="mt-2 text-slate-500">Your details will appear in My Profile and Profile Settings.</p></div>
          {location.state?.notice && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{location.state.notice}</p>}
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={form.name} onChange={(name) => setForm({...form, name})} required/><Field label="Work email" type="email" value={form.email} onChange={(email) => setForm({...form, email})} required/></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Password" type="password" value={form.password} onChange={(password) => setForm({...form, password})} required/><Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(confirmPassword) => setForm({...form, confirmPassword})} required/></div>
            <fieldset><legend className="text-sm font-bold text-slate-700">What is your role?</legend><div className="mt-3 grid gap-3 sm:grid-cols-3">{roles.map((role) => <label key={role.value} className={`cursor-pointer rounded-xl border p-4 transition ${form.role === role.value ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-slate-300"}`}><input className="sr-only" type="radio" name="role" value={role.value} checked={form.role === role.value} onChange={() => setForm({...form, role: role.value})}/><div className="flex items-center justify-between font-black">{role.title}{form.role === role.value && <Check size={17} className="text-blue-700"/>}</div><p className="mt-2 text-xs leading-5 text-slate-500">{role.text}</p></label>)}</div></fieldset>
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
            <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3.5 font-black text-white hover:bg-blue-800 disabled:opacity-60">{submitting ? "Creating..." : "Continue to organization"}<ArrowRight size={18}/></button>
            <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-400"><Users size={14}/>Admin and Manager have equal access. User accounts have limited access.</p>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", required }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"/></label>; }
