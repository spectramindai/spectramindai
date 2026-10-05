import { UserCircle } from "lucide-react";
import { useMemo } from "react";
import { useUser } from "../auth/UserContext";
import AppShell from "../components/layout/AppShell";

export default function Profile() {
  const { user } = useUser();
  const details = useMemo(
    () => [
      ["Full Name", user?.name || "User"],
      ["Email", user?.email || ""],
      ["Role", user?.role || "User"],
      ["Organization", user?.organizationName || ""],
    ],
    [user]
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Account
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
            My Profile
          </h1>
        </div>

        <div className="grid gap-6 md:grid-cols-[320px_1fr]">
          <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-600 text-white">
              <UserCircle size={58} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">
              {user?.name || "User"}
            </h2>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {user?.role || "User"}
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
              User Information
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-1 font-bold text-slate-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
