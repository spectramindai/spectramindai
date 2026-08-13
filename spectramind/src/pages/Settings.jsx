import { UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useUser } from "../auth/UserContext";
import { writeScopedJson } from "../auth/session";
import { isApiEnabled } from "../api/client";
import { getCurrentOrganization, updateCurrentOrganization } from "../api/organizations";
import AppShell from "../components/layout/AppShell";
import {
  APP_NAME,
  saveOrganizationLogo,
  useOrganizationLogo,
} from "../core/adapters/useOrganizationBranding";

export default function Settings() {
  const organizationLogo = useOrganizationLogo();
  const { user, updateUser } = useUser();
  const [uploadError, setUploadError] = useState("");
  const [organizationName, setOrganizationName] = useState(user?.organizationName || APP_NAME);
  const [contactEmail, setContactEmail] = useState(user?.contactEmail || user?.email || "");
  const [saved, setSaved] = useState(false);
  const [logoValue, setLogoValue] = useState(organizationLogo);

  useEffect(() => {
    if (!isApiEnabled) return;
    getCurrentOrganization().then((organization) => {
      setOrganizationName(organization.name || APP_NAME);
      setContactEmail(organization.contactEmail || "");
      setLogoValue(organization.logoDataUrl || "");
    }).catch((error) => setUploadError(error.message || "Could not load organization settings."));
  }, []);

  const handleLogoUpload = (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      input.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const value = String(reader.result || "");
      setLogoValue(value);
      saveOrganizationLogo(value);
      setUploadError("");
      input.value = "";
    };

    reader.onerror = () => {
      setUploadError("Logo upload failed. Please try another image.");
      input.value = "";
    };

    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoValue("");
    saveOrganizationLogo("");
    setUploadError("");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
            Workspace
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">
            Manage organization details and product preferences.
          </p>
        </div>

        <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-5">
            <Field label="Organization Name" value={organizationName} onChange={setOrganizationName} />
            <Field label="Contact Email" value={contactEmail} onChange={setContactEmail} type="email" />
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Organization Logo
              </span>
              <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-[#fffdf8]/72 p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-blue-600/25 bg-blue-600 text-xl font-black text-white shadow-sm">
                    {logoValue ? (
                      <img
                        src={logoValue}
                        alt="Organization logo preview"
                        className="h-full w-full bg-white object-contain p-1"
                      />
                    ) : (
                      "S"
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {logoValue ? "Custom logo active" : `${APP_NAME} default logo`}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {isApiEnabled ? "Shared securely with this organization." : "Stored locally for this development browser."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-600/25 bg-white px-4 text-sm font-black text-slate-800 transition hover:border-blue-600/40 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <UploadCloud size={16} />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoValue && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:border-rose-300 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <X size={16} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {uploadError && (
                <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                  {uploadError}
                </p>
              )}
            </div>
          </div>

          {saved && <p className="mt-4 text-sm font-semibold text-emerald-700">Organization settings saved.</p>}
          <button onClick={async () => {
            const next = { organizationName: organizationName.trim(), contactEmail: contactEmail.trim() };
            try {
              if (isApiEnabled) {
                await updateCurrentOrganization({ name: next.organizationName, contactEmail: next.contactEmail, logoDataUrl: logoValue });
              } else {
                writeScopedJson("spectramind:organization-profile", next);
              }
              updateUser(next);
              saveOrganizationLogo(logoValue);
              setSaved(true);
              setUploadError("");
            } catch (error) {
              setSaved(false);
              setUploadError(error.message || "Could not save organization settings.");
            }
          }} className="mt-6 rounded-lg bg-primary px-5 py-3 font-semibold text-white transition hover:bg-blue-700">
            Save Changes
          </button>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-blue-950"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
