import {
  Bot,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Plug,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { APP_NAME, useOrganizationLogo } from "../../core/adapters/useOrganizationBranding";
import { useFrameworkWorkspace } from "../../framework/FrameworkWorkspaceContext";
import { useUser } from "../../auth/UserContext";

const dashboardItem = { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard };

const frameworkItem = { name: "Framework", path: "/frameworks", icon: ShieldCheck };

const frameworkScopedComplianceItems = [
  { name: "AI Assistant", path: "/assistant", icon: Bot },
  { name: "Questionnaire", path: "/questionnaire", icon: ClipboardList },
  { name: "Implementation", path: "/implementation", icon: Wrench },
  { name: "Policies", path: "/policies", icon: FileText },
  { name: "Training", path: "/training", icon: GraduationCap },
  { name: "Employees", path: "/employees", icon: Users },
  { name: "Integrations", path: "/integrations", icon: Plug },
  { name: "Audits", path: "/audits", icon: ClipboardCheck },
  { name: "Comments", path: "/comments", icon: MessageSquare },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
];

const workspaceItems = [
  { name: "Trust Center", path: "/trust-center", icon: Lock },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const organizationLogo = useOrganizationLogo();
  const { activeFramework } = useFrameworkWorkspace();
  const { user } = useUser();
  const complianceItems = activeFramework
    ? [frameworkItem, ...frameworkScopedComplianceItems]
    : [frameworkItem];

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-white/70 bg-[#fffdf8]/78 px-4 py-5 text-slate-900 shadow-2xl shadow-slate-900/5 backdrop-blur-2xl lg:block">
      <Link
        to="/dashboard"
        className="flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-white/60"
      >
        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-blue-600/30 bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-600/20">
          {organizationLogo ? (
            <img
              src={organizationLogo}
              alt="Organization logo"
              className="h-full w-full bg-white object-contain p-1"
            />
          ) : (
            "S"
          )}
        </span>
        <div>
          <p className="text-xl font-black leading-tight text-slate-950">
            {user?.organizationName || APP_NAME}
          </p>
          <p className="text-[10px] font-bold text-slate-400">
            Compliance workspace
          </p>
        </div>
      </Link>

      <nav className="mt-6 space-y-5">
        <NavItem item={dashboardItem} activePath={location.pathname} />

        <NavGroup title="Compliance" items={complianceItems} activePath={location.pathname} />

        <NavGroup title="Workspace" items={workspaceItems} activePath={location.pathname} />
      </nav>
    </aside>
  );
}

function NavGroup({ title, items, activePath }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-xs font-black uppercase tracking-widest text-blue-700/75">
        {title}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <NavItem key={item.path} item={item} activePath={activePath} />
        ))}
      </div>
    </div>
  );
}

function NavItem({ item, activePath }) {
  const Icon = item.icon;
  const isActive = activePath === item.path;

  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        isActive
          ? "border border-blue-600/20 bg-blue-50 text-blue-800 shadow-sm shadow-blue-600/10"
          : "text-slate-600 hover:bg-white/62 hover:text-slate-900"
      }`}
    >
      <Icon size={17} />
      <span>{item.name}</span>
    </Link>
  );
}
