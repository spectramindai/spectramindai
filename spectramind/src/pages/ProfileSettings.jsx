import { useUser } from "../auth/UserContext";
import AppShell from "../components/layout/AppShell";
import { useState } from "react";

export default function ProfileSettings() {
  const { user, updateUser } = useUser();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saved, setSaved] = useState(false);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Account
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
            Profile Settings
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Update your profile information and account credentials.
          </p>
        </div>

        <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-5">
            <Field label="Full Name" value={name} onChange={setName} />
            <Field label="Email" value={email} onChange={setEmail} type="email" />
            <Field label="Password" value="" onChange={() => {}} type="password" placeholder="Leave blank to keep current password" />
          </div>

          {saved && <p className="mt-4 text-sm font-semibold text-emerald-700">Profile updated successfully.</p>}
          <button onClick={() => { updateUser({ name: name.trim(), email: email.trim().toLowerCase() }); setSaved(true); }} className="mt-6 rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700">
            Update Profile
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        type={type}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
