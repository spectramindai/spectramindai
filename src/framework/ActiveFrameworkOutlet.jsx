import { Outlet } from "react-router-dom";
import ActiveFrameworkRequired from "./ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "./FrameworkWorkspaceContext";

export default function ActiveFrameworkOutlet({ frameworkSlug }) {
  const { activeFramework, isLoadingFrameworks, frameworkLoadError } = useFrameworkWorkspace();

  if (isLoadingFrameworks) {
    return <FrameworkLoading />;
  }

  if (frameworkLoadError) {
    return <FrameworkLoadFailure message={frameworkLoadError} />;
  }

  if (!activeFramework || (frameworkSlug && activeFramework.slug !== frameworkSlug)) {
    return <ActiveFrameworkRequired />;
  }

  return <Outlet />;
}

function FrameworkLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-700" />
        <p className="mt-4 font-semibold text-slate-700">Loading your organization workspace…</p>
      </div>
    </div>
  );
}

function FrameworkLoadFailure({ message }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-lg rounded-xl border border-rose-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-950">Workspace could not be loaded</h1>
        <p className="mt-3 text-slate-600">{message}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-primary px-5 py-3 font-semibold text-white">
          Try again
        </button>
      </div>
    </div>
  );
}
