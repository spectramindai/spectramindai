import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../auth/UserContext";
import { APP_NAME } from "../core/adapters/useOrganizationBranding";
import { isApiEnabled } from "../api/client";
import { findLocalAccount, findLocalInvitations } from "../data/localAccounts";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const highlights = [
  "Audit-ready evidence workflows",
  "Risk and vendor visibility",
  "Trust center built for customers",
];

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithPassword } = useUser();
  const googleButtonRef = useRef(null);
  const [googleStatus, setGoogleStatus] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleGoogleCredential = useCallback(
    (response) => {
      const profile = decodeJwt(response.credential);
      const existingAccount = findLocalAccount(profile.email);
      if (!existingAccount) {
        navigate("/signup", { state: { notice: "User not present. Create an account to continue.", email: profile.email, name: profile.name } });
        return;
      }
      login({
        ...existingAccount,
        id: profile.sub,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });

      navigate("/dashboard");
    },
    [login, navigate]
  );

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    const scriptId = "google-identity-services";

    const initializeGoogle = () => {
      if (!window.google || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        size: "large",
        theme: "outline",
        type: "standard",
        shape: "rectangular",
        text: "continue_with",
        width: 360,
      });
    };

    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      initializeGoogle();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => {
      setGoogleStatus("Google sign-in could not load. Please try email sign-in.");
    };

    document.head.appendChild(script);
  }, [handleGoogleCredential]);

  const handleEmailSignIn = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setLoginError("");
    try {
      const nextSession = await loginWithPassword(email, password, { remember });
      if (!nextSession.onboardingComplete) {
        navigate(nextSession.organizationSetupSkipped ? "/dashboard" : findLocalInvitations(nextSession.email).length ? "/join-organization" : nextSession.role === "User" ? "/join-organization" : "/onboarding/organization");
      } else {
        navigate("/dashboard");
      }
    } catch (error) {
      if (error.code === "USER_NOT_FOUND" || error.status === 404) {
        navigate("/signup", { state: { notice: "User not present. Create an account to continue.", email } });
        return;
      }
      setLoginError(error.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleFallback = () => {
    if (!googleClientId) {
      setGoogleStatus("Add VITE_GOOGLE_CLIENT_ID to enable Google sign-in.");
      return;
    }

    setGoogleStatus("Google sign-in is loading. Please try again in a moment.");
  };

  return (
    <div className="min-h-screen text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/70 bg-[#fffdf8]/68 px-12 py-8 shadow-2xl shadow-slate-900/5 backdrop-blur lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(216,180,109,.34),transparent_30%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,.76),transparent_28%),linear-gradient(135deg,rgba(255,255,255,.46),rgba(236,231,220,.48))]" />

          <Link to="/" className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-600/30 bg-[linear-gradient(135deg,rgba(255,255,255,.95),rgba(216,180,109,.52))] text-xl font-black text-blue-700 shadow-lg shadow-blue-600/20">
              S
            </span>
            <span className="text-2xl font-black">{APP_NAME}</span>
          </Link>

          <div className="relative flex flex-1 flex-col justify-center py-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-lg border border-blue-600/20 bg-white/52 px-4 py-2 text-sm font-bold text-blue-700 shadow-lg shadow-blue-600/10 backdrop-blur">
                <Sparkles size={16} />
                Secure access for compliance teams
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight">
                Welcome back to your trust workspace.
              </h1>

              <p className="mt-5 text-lg leading-8 text-slate-600">
                Sign in to manage controls, evidence, risks, vendors, and trust
                reporting from one focused operating system.
              </p>

              <div className="mt-7 space-y-3">
                {highlights.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-slate-700">
                    <CheckCircle2 size={20} className="text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative rounded-lg border border-white/75 bg-white/58 p-4 shadow-xl shadow-slate-900/5 backdrop-blur [@media(max-height:760px)]:hidden">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-blue-700" size={24} />
              <div>
                <p className="font-black">Protected product access</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Public visitors can view testimonials. Authorized users can enter the dashboard.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 lg:px-12">
          <div className="w-full max-w-md rounded-lg border border-white/75 bg-white/68 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur">
            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
            >
              <ArrowLeft size={17} />
              Back to homepage
            </Link>

            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
                <LockKeyhole size={24} />
              </div>
              <h2 className="text-4xl font-black">Sign in</h2>
              <p className="mt-3 leading-7 text-slate-600">
                Use your work email or continue with Google to access {APP_NAME}.
              </p>
            </div>

            <div className="mb-5">
              {googleClientId && !isApiEnabled ? (
                <div ref={googleButtonRef} className="min-h-11" />
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleFallback}
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white/72 px-4 py-3 font-semibold text-slate-800 transition hover:bg-white hover:text-blue-700"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-sm font-bold">
                    G
                  </span>
                  Continue with Google
                </button>
              )}

              {googleStatus && (
                <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                  {googleStatus}
                </p>
              )}
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-sm font-semibold text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Work email
                </span>
                <input
                  type="email"
                  placeholder="you@company.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/78 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white/78 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              {loginError && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {loginError}
                </p>
              )}

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 text-slate-600">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-blue-700" />
                  Remember me
                </label>
                <Link to="/forgot-password" state={{ email }} className="font-semibold text-blue-700 hover:text-blue-800">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-600/35 bg-[linear-gradient(135deg,rgba(255,246,216,.96),rgba(216,180,109,.74)_48%,rgba(168,117,52,.86))] px-4 py-3 font-bold text-slate-900 shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5"
              >
                {submitting ? "Signing in..." : "Sign In"}
                <ArrowRight size={18} />
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              New to {APP_NAME}? <Link to="/signup" className="font-bold text-blue-700 hover:text-blue-800">Create an account</Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function decodeJwt(token) {
  const payload = token.split(".")[1];
  const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(normalizedPayload)
      .split("")
      .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join("")
  );

  return JSON.parse(json);
}
