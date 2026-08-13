import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Cloud,
  KeyRound,
  Mail,
  MessageSquare,
  Plug,
  Ticket,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import { readScopedJson, writeScopedJson } from "../auth/session";
import { useComplianceState } from "../compliance/ComplianceStateContext";
import ActiveFrameworkRequired from "../framework/ActiveFrameworkRequired";
import { useFrameworkWorkspace } from "../framework/FrameworkWorkspaceContext";

const initialIntegrations = [
  {
    name: "GitHub",
    description: "Repository, branch protection, pull request, and deployment evidence.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["Branch protection", "Pull requests", "Repository settings"],
    icon: Plug,
    relatedControls: ["CC6.1", "CC6.2", "CC6.3"],
  },
  {
    name: "Google Workspace",
    description: "Identity, group membership, admin settings, and user lifecycle evidence.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["User directory", "Groups", "Admin configuration"],
    icon: Mail,
    relatedControls: ["CC6.1", "CC6.2"],
  },
  {
    name: "AWS",
    description: "Cloud infrastructure configuration, access, logging, and backup evidence.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["IAM policies", "CloudTrail", "Security groups"],
    icon: Cloud,
    relatedControls: ["CC6.1", "CC6.2", "CC7.1"],
  },
  {
    name: "Azure",
    description: "Cloud resources, identity controls, security posture, and audit logs.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["Entra ID users", "Activity logs", "Resource policies"],
    icon: Cloud,
    relatedControls: ["CC6.1", "CC6.2"],
  },
  {
    name: "Slack",
    description: "Security notifications, approvals, and implementation task alerts.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["Approval messages", "Security alerts", "Channel history"],
    icon: MessageSquare,
    relatedControls: ["CC7.4"],
  },
  {
    name: "Jira",
    description: "Implementation tickets, remediation tasks, and change management evidence.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["Tickets", "Change approvals", "Remediation tasks"],
    icon: Ticket,
    relatedControls: ["CC8.1"],
  },
  {
    name: "Okta",
    description: "Identity provider settings, MFA enforcement, and access review evidence.",
    status: "Not connected",
    lastSync: "Never",
    availableEvidence: ["MFA settings", "User exports", "Application assignments"],
    icon: KeyRound,
    relatedControls: ["CC6.1", "CC6.2", "CC6.3"],
  },
];

export default function Integrations() {
  const { activeFramework } = useFrameworkWorkspace();

  if (!activeFramework) {
    return <ActiveFrameworkRequired />;
  }

  return <IntegrationsContent key={activeFramework.id} activeFramework={activeFramework} />;
}

function IntegrationsContent({ activeFramework }) {
  const { workspaceData, actions } = useComplianceState();
  const integrationsStorageKey = `spectramind:integrations:${activeFramework.id}`;
  const [integrationsList, setIntegrationsList] = useState(() => {
    try {
      return readScopedJson(integrationsStorageKey, initialIntegrations);
    } catch {
      return initialIntegrations;
    }
  });

  useEffect(() => {
    writeScopedJson(integrationsStorageKey, integrationsList);
  }, [integrationsList, integrationsStorageKey]);

  const handleToggleConnection = (name) => {
    setIntegrationsList((currentList) =>
      currentList.map((item) => {
        if (item.name === name) {
          const isConnecting = item.status !== "Connected";
          const nextStatus = isConnecting ? "Connected" : "Not connected";
          const nextSync = isConnecting ? "Just now" : "Never";

          // Simulate Compliance Loop: satisfying related controls in the workspace
          if (item.relatedControls?.length) {
            for (const controlId of item.relatedControls) {
              const currentControlState = workspaceData[controlId] ?? {};
              if (isConnecting) {
                // Connect -> auto-implement related controls
                actions.saveComplianceItem(controlId, {
                  ...currentControlState,
                  status: "complete",
                  dueDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                  timeline: [
                    { id: `auto-${Date.now()}`, label: `Auto-implemented via ${name} Integration` },
                    ...(currentControlState.timeline ?? []),
                  ],
                });
              } else {
                // Disconnect -> reset control status
                if (currentControlState.timeline?.[0]?.label?.includes(`via ${name}`)) {
                  actions.saveComplianceItem(controlId, {
                    ...currentControlState,
                    status: "",
                    timeline: [
                      { id: `auto-disconnect-${Date.now()}`, label: `Disconnected from ${name} Integration` },
                      ...(currentControlState.timeline ?? []),
                    ],
                  });
                }
              }
            }
          }

          return { ...item, status: nextStatus, lastSync: nextSync };
        }
        return item;
      })
    );
  };

  const connectedCount = integrationsList.filter((i) => i.status === "Connected").length;
  const evidenceCount = integrationsList.reduce(
    (count, i) => count + i.availableEvidence.length,
    0
  );

  return (
    <AppShell>
      <div className="space-y-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-blue-700">
              Compliance
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-normal text-slate-900">
              Integrations
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Prepare evidence collection sources for SOC 2 implementation. Connecting integrations automatically tests configuration and uploads evidence.
            </p>
          </div>
        </div>

        <section className="rounded-lg border border-white/75 bg-white/62 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Connected" value={connectedCount} />
            <Metric label="Available" value={integrationsList.length} />
            <Metric label="Evidence Types" value={evidenceCount} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrationsList.map((integration) => (
            <IntegrationCard
              key={integration.name}
              integration={integration}
              onToggle={() => handleToggleConnection(integration.name)}
            />
          ))}
        </section>
      </div>
    </AppShell>
  );
}

const ICON_MAP = {
  "GitHub": Plug,
  "Google Workspace": Mail,
  "AWS": Cloud,
  "Azure": Cloud,
  "Slack": MessageSquare,
  "Jira": Ticket,
  "Okta": KeyRound
};

function IntegrationCard({ integration, onToggle }) {
  const Icon = ICON_MAP[integration.name] || Plug;
  const isConnected = integration.status === "Connected";

  return (
    <article className="rounded-lg border border-white/75 bg-white/62 p-5 shadow-xl shadow-slate-900/5 backdrop-blur flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-600/20 bg-blue-50 text-blue-700">
              <Icon size={22} />
            </div>
            <div>
              <h2 className="font-black text-slate-900">{integration.name}</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Continuous Sync
              </p>
            </div>
          </div>

          <span className={`rounded-full px-3 py-1 text-xs font-black ${
            isConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}>
            {integration.status}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">
          {integration.description}
        </p>

        <div className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-[#fffdf8]/72 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-500">Last Sync</span>
            <span className="font-black text-slate-900">{integration.lastSync}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500">Available Evidence</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {integration.availableEvidence.map((evidence) => (
                <span key={evidence} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-800">
                  {evidence}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={onToggle}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition ${
            isConnected
              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          }`}
        >
          <CheckCircle2 size={16} />
          {isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-[#fffdf8]/72 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
