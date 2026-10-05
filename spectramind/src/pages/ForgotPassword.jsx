import { ArrowLeft, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isApiEnabled, requestPasswordResetApi } from "../api/client";
import { createLocalPasswordReset } from "../data/localAccounts";

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async event => {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      const result = isApiEnabled ? await requestPasswordResetApi(email) : { resetToken: createLocalPasswordReset(email) };
      setMessage("If an account exists for this email, reset instructions have been created.");
      if (result?.resetToken) navigate(`/reset-password?token=${encodeURIComponent(result.resetToken)}`, { state: { email } });
    } catch (requestError) { setError(requestError.message || "Could not create reset instructions"); }
    finally { setSubmitting(false); }
  };

  return <AuthPage icon={Mail} title="Forgot your password?" description="Enter your work email. Reset links expire after 30 minutes and can only be used once."><form onSubmit={submit} className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Work email</span><input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"/></label>{message && <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p>}{error && <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}<button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white disabled:bg-slate-400"><KeyRound size={18}/>{submitting ? "Creating reset link..." : "Reset password"}</button><Link to="/login" className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"><ArrowLeft size={16}/>Back to sign in</Link></form></AuthPage>;
}

export function AuthPage({ icon: Icon, title, description, children }) { return <main className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-5 py-12"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Icon size={24}/></div><h1 className="mt-6 text-3xl font-black tracking-tight text-slate-950">{title}</h1><p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{description}</p><div className="mt-7">{children}</div><div className="mt-7 flex items-center gap-2 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-400"><ShieldCheck size={15}/>Secure account recovery</div></section></main>; }
