import { Link, useLocation } from "react-router-dom";

const modules = [
  ["Overview", "/dashboard?framework=cmmc"], ["Scope", "/cmmc/scope"], ["Requirements", "/cmmc/controls"],
  ["Gap Wizard", "/cmmc/gap-wizard"], ["Evidence", "/cmmc/uploaded-evidence"], ["POA&M", "/cmmc/poam"],
  ["SSP", "/cmmc/ssp"], ["Policies", "/cmmc/policies"], ["Calendar", "/cmmc/operations/calendar"],
  ["SPRS", "/cmmc/sprs-score"],
];

export default function CMMCModuleNavigation() {
  const { pathname, search } = useLocation();
  const legacyTab = new URLSearchParams(search).get("tab") || "ssp";
  const activePath = pathname === "/cmmc/evidence" ? `/cmmc/${legacyTab}` : pathname === "/cmmc" ? "/cmmc/scope" : pathname.startsWith("/cmmc/domains/") ? "/cmmc/domains" : pathname;

  return <nav aria-label="CMMC workspace" className="rounded-xl border border-emerald-100 bg-white p-2 shadow-sm">
    <div className="flex gap-1 overflow-x-auto [scrollbar-width:thin]">
      {modules.map(([label, path]) => {
        const route = path.split("?")[0];
        const active = activePath === route || (route === "/dashboard" && pathname === "/dashboard" && new URLSearchParams(search).get("framework") === "cmmc");
        return <Link key={path} to={path} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${active ? "bg-[#071a33] text-white" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"}`}>{label}</Link>;
      })}
    </div>
  </nav>;
}
