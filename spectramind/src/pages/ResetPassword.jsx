import { CheckCircle2, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { isApiEnabled, resetPasswordApi } from "../api/client";
import { resetLocalAccountPassword } from "../data/localAccounts";
import { AuthPage } from "./ForgotPassword";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const valid = password.length >= 12 && password === confirmPassword && Boolean(token);
  const submit = async event => { event.preventDefault(); if (!valid) return; setSubmitting(true); setError(""); try { if (isApiEnabled) await resetPasswordApi(token, password); else if (!(await resetLocalAccountPassword(token, password))) throw new Error("This password reset link is invalid or has expired"); setComplete(true); } catch (requestError) { setError(requestError.message || "Could not reset password"); } finally { setSubmitting(false); } };
  if (complete) return <AuthPage icon={CheckCircle2} title="Password updated" description="Your new password is ready. You can now return to the sign-in page."><Link to="/login" className="flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white">Continue to sign in</Link></AuthPage>;
  return <AuthPage icon={KeyRound} title="Create a new password" description="Use at least 12 characters. Your reset link can only be used once."><form onSubmit={submit} className="space-y-4"><PasswordField label="New password" value={password} onChange={setPassword}/><PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword}/>{confirmPassword && password !== confirmPassword && <p className="text-sm font-semibold text-rose-700">Passwords do not match.</p>}{!token && <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">This reset link is missing its security token.</p>}{error && <p className="rounded-xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}<button disabled={!valid || submitting} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white disabled:bg-slate-300">{submitting ? "Updating password..." : "Update password"}</button></form></AuthPage>;
}

function PasswordField({ label, value, onChange }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input type="password" required minLength="12" value={value} onChange={event => onChange(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"/></label>; }
