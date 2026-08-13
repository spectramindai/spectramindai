import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import CMMCImplementationLayout from "../components/CMMCImplementationLayout";
import { useCMMCWorkspaceFilters } from "../components";
import { useCMMCWorkflowState } from "../hooks";

const sections = [
  {
    id: "inventory",
    title: "System Inventory",
    subtitle: "Cloud services, devices, servers, network",
    questions: [
      {
        id: "cloudEmail",
        label: "Do you use cloud-based email?",
        reference: "NIST SP 800-18 3.2.1 \u2014 System Description; NIST SP 800-171 3.1 \u2014 System Boundary",
        type: "checkbox",
        options: [
          "Microsoft 365 GCC High (Government Community Cloud High)",
          "Microsoft 365 GCC (Government Community Cloud)",
          "Microsoft 365 Commercial (standard business subscription)",
          "Google Workspace for Government (FedRAMP authorized)",
          "Google Workspace Commercial (standard)",
          "Other cloud email",
          "On-premises email only",
          "No email system",
        ],
      },
      {
        id: "cloudFileStorage",
        label: "Do you use cloud file storage?",
        reference: "NIST SP 800-18 3.2.1 \u2014 System Description; CMMC CAP Scoping Guidance",
        type: "checkbox",
        options: [
          "SharePoint / OneDrive (part of M365 GCC High)",
          "SharePoint / OneDrive (part of M365 GCC)",
          "SharePoint / OneDrive (Commercial)",
          "Google Drive for Government (FedRAMP authorized)",
          "Google Drive Commercial",
          "Dropbox / Box",
          "AWS S3 or similar",
          "Other cloud storage",
          "No cloud file storage",
        ],
      },
      {
        id: "onPremServers",
        label: "Do you have on-premises servers?",
        reference: "NIST SP 800-37 3.2.1 \u2014 System Boundary Definition",
        type: "radio",
        options: [
          "Yes \u2014 1 to 5 servers",
          "Yes \u2014 6 to 20 servers",
          "Yes \u2014 more than 20 servers",
          "No on-premises servers",
        ],
      },
      {
        id: "cloudPlatforms",
        label: "Do you use cloud computing platforms?",
        reference: "NIST SP 800-18 3.2.1 \u2014 System Description; CMMC CAP Scoping Guidance",
        type: "checkbox",
        options: [
          "Microsoft Azure",
          "Amazon Web Services (AWS)",
          "Google Cloud Platform",
          "Other cloud platforms",
          "No cloud computing platforms",
        ],
      },
      {
        id: "endUserDevices",
        label: "What types of end-user devices does your organization use?",
        reference: "NIST SP 800-171 Rev 2 AC.L1.001 \u2014 Authorized Users and Devices",
        type: "checkbox",
        options: [
          "Windows laptops",
          "Mac laptops",
          "Windows desktops",
          "Tablets (company-owned)",
          "Smartphones (company-owned)",
        ],
      },
      {
        id: "networkInfrastructure",
        label: "Do you manage your own network infrastructure?",
        reference: "NIST SP 800-171 Rev 2 SC family \u2014 System & Communications Protection",
        type: "radio",
        options: [
          "Yes \u2014 firewalls, switches, routers",
          "Yes \u2014 basic router/firewall only",
          "No \u2014 managed by ISP or MSP",
          "No network infrastructure",
        ],
      },
    ],
  },
  {
    id: "cuiFlow",
    title: "CUI Flow",
    subtitle: "How CUI is received, stored, and shared",
    questions: [
      { id: "receivedFrom", label: "How does your organization receive CUI?", type: "checkbox", options: ["DoD portal", "Prime contractor", "Encrypted email", "SFTP", "Physical media"] },
      { id: "storageLocations", label: "Where is CUI stored?", type: "checkbox", options: ["Document repository", "Engineering drawings system", "Email", "ERP", "Local file shares"] },
      { id: "transmissionMethods", label: "How is CUI transmitted externally?", type: "checkbox", options: ["Encrypted email", "Secure portal", "SFTP", "Managed file transfer", "Not transmitted externally"] },
      { id: "retentionPeriod", label: "What is the expected CUI retention period?", type: "select", options: ["Select retention", "Less than 1 year", "1-3 years", "3-7 years", "Contract-defined"] },
      { id: "flowDescription", label: "Summarize the primary CUI flow.", type: "textarea", placeholder: "Describe intake, storage, processing, sharing, and disposal." },
    ],
  },
  {
    id: "workforce",
    title: "Workforce",
    subtitle: "Headcount, remote workers, BYOD, IT support",
    questions: [
      {
        id: "cuiEmployeeAccess",
        label: "How many employees have access to CUI?",
        reference: "NIST SP 800-171 Rev 2 AC.L1.001 \u2014 Limit system access to authorized users",
        type: "radio",
        options: ["1 \u2013 5", "6 \u2013 15", "16 \u2013 50", "51 \u2013 100", "More than 100"],
      },
      {
        id: "remoteEmployees",
        label: "Do employees work remotely?",
        reference: "NIST SP 800-171 Rev 2 AC.2.006 \u2014 Remote Access; SC.3.177 \u2014 Encrypted Transmission",
        type: "radio",
        options: [
          "Yes \u2014 fully remote",
          "Yes \u2014 some employees are remote",
          "No \u2014 all employees work on-site",
        ],
      },
      {
        id: "byodUse",
        label: "Do employees use personal devices for work (BYOD)?",
        reference: "NIST SP 800-171 Rev 2 AC.L1.001; CMMC CAP Scoping Guidance \u2014 BYOD",
        type: "radio",
        options: [
          "Yes \u2014 personal devices access CUI",
          "Yes \u2014 personal devices used but not for CUI",
          "No \u2014 company devices only",
        ],
      },
      {
        id: "dedicatedItSupport",
        label: "Do you have a dedicated IT person or team?",
        reference: "NIST SP 800-171 Rev 2 AT family \u2014 Awareness & Training; CA family \u2014 Assessment",
        type: "radio",
        options: [
          "Yes \u2014 internal IT staff",
          "Yes \u2014 outsourced Managed Service Provider (MSP)",
          "No dedicated IT support",
        ],
      },
    ],
  },
  {
    id: "connections",
    title: "External Connections",
    subtitle: "VPN, third-party IT, subcontractors, gov portals",
    questions: [
      { id: "vpnRequired", label: "Is VPN required for remote access to scoped systems?", type: "radio", options: ["Yes", "No", "Conditional"] },
      { id: "thirdPartyAccess", label: "Which third parties can access scoped systems?", type: "checkbox", options: ["MSP", "Cloud provider support", "Subcontractors", "Prime contractor", "None"] },
      { id: "govPortals", label: "Which government or prime portals are used for CUI exchange?", type: "checkbox", options: ["PIEE", "SPRS", "DIBNet", "Prime contractor portal", "Other"] },
      { id: "connectionReview", label: "How often are external connections reviewed?", type: "select", options: ["Select cadence", "Monthly", "Quarterly", "Annually", "Ad hoc"] },
      { id: "interconnectionNotes", label: "Document key interconnection boundaries.", type: "textarea", placeholder: "List VPNs, tunnels, APIs, portals, and support access paths." },
    ],
  },
  {
    id: "cuiType",
    title: "CUI Type",
    subtitle: "CUI categories, DFARS clause, export controls",
    questions: [
      {
        id: "cuiCategories",
        label: "What type(s) of CUI does your organization handle?",
        reference: "DoD CUI Registry (archives.gov/cui); 32 CFR Part 2002 \u2014 CUI Categories",
        type: "checkbox",
        options: [
          "Technical Data / Engineering drawings",
          "Export Controlled (ITAR/EAR)",
          "Privacy / Personally Identifiable Information (PII)",
          "Law Enforcement Sensitive",
          "Financial / Procurement",
          "General CUI (other)",
        ],
      },
      {
        id: "dfarsClause",
        label: "Do your contracts include DFARS clause 252.204-7012?",
        reference: "DFARS 252.204-7012 \u2014 Safeguarding Covered Defense Information; this is the clause that triggers CMMC requirements",
        type: "radio",
        options: ["Yes", "No", "Unsure \u2014 I need to check my contracts"],
      },
      {
        id: "exportControlledCui",
        label: "Is any of your CUI marked export controlled (CUI//SP-ITAR or CUI//CTI)?",
        reference: "22 CFR 120-130 (ITAR); 15 CFR 730-774 (EAR); NIST SP 800-171B \u2014 Enhanced Security Requirements",
        type: "radio",
        options: ["Yes", "No", "Unsure"],
      },
    ],
  },
];

const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);

export default function CMMCScopePage() {
  const { searchQuery, resetVersion } = useCMMCWorkspaceFilters();
  return (
    <CMMCImplementationLayout>
      <CMMCScopeContent key={resetVersion} searchQuery={searchQuery} />
    </CMMCImplementationLayout>
  );
}

function CMMCScopeContent({ searchQuery }) {
  const { scopeAnswers: answers, updateScopeAnswers } = useCMMCWorkflowState();
  const [openSections, setOpenSections] = useState(() => ({
    inventory: true,
    cuiFlow: false,
    workforce: false,
    connections: false,
    cuiType: false,
  }));

  const answeredCount = useMemo(
    () => sections.flatMap((section) => section.questions).filter((question) => isAnswered(answers[question.id])).length,
    [answers]
  );
  const progress = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedSearch) {
      return sections;
    }

    return sections
      .map((section) => ({
        ...section,
        questions: section.questions.filter((question) =>
          [section.title, section.subtitle, question.label, question.reference, question.placeholder, ...(question.options || [])]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        ),
      }))
      .filter((section) => section.questions.length > 0);
  }, [normalizedSearch]);

  const updateAnswer = (id, value) => {
    updateScopeAnswers((current) => ({ ...current, [id]: value }));
  };

  const toggleCheckbox = (id, option) => {
    updateScopeAnswers((current) => {
      const selected = Array.isArray(current[id]) ? current[id] : [];
      const next = selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option];

      return { ...current, [id]: next };
    });
  };

  const goToNextSection = (sectionId) => {
    const sectionIndex = sections.findIndex((section) => section.id === sectionId);
    const nextSection = sections[sectionIndex + 1];
    if (!nextSection) return;

    setOpenSections((current) => ({
      ...current,
      [sectionId]: false,
      [nextSection.id]: true,
    }));
  };

  const completeSection = (sectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: false,
    }));
  };

  return (
    <div className="mx-auto max-w-5xl">
        <section className="mb-4 rounded-lg bg-gradient-to-r from-[#22164b] to-[#694df4] p-6 text-white shadow-xl shadow-violet-950/15">
          <h1 className="text-2xl font-black tracking-normal">System Scope Questionnaire</h1>
          <p className="mt-2 text-sm font-semibold text-violet-100">
            Define your CUI boundary before the Gap Wizard. Answers should later populate the SSP.
          </p>
          <div className="mt-5 flex items-center gap-4">
            <div className="h-2 flex-1 rounded-full bg-white/25">
              <div
                className="h-2 rounded-full bg-white transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="min-w-max text-sm font-black">
              {answeredCount} / {totalQuestions} Answered
            </span>
          </div>
        </section>

        <div className="space-y-2">
          {visibleSections.map((section) => {
            const sectionAnswered = section.questions.filter((question) => isAnswered(answers[question.id])).length;
            const isOpen = openSections[section.id];
            const sectionIndex = sections.findIndex((item) => item.id === section.id);
            const nextSection = sections[sectionIndex + 1];

            return (
              <section
                key={section.id}
                className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
                  isOpen ? "border-violet-300" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !current[section.id] }))}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span>
                    <span className="block text-xs font-black uppercase tracking-wide text-slate-800">
                      {section.title}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {section.subtitle}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-xs font-black text-slate-500">
                    {sectionAnswered}/{section.questions.length}
                    <ChevronDown
                      size={16}
                      className={`transition ${isOpen ? "rotate-180 text-violet-600" : ""}`}
                    />
                  </span>
                </button>

                {isOpen && (
                  <div className="space-y-5 border-t border-slate-100 px-5 py-5">
                    {section.questions.map((question) => (
                      <QuestionField
                        key={question.id}
                        question={question}
                        value={answers[question.id]}
                        onChange={updateAnswer}
                        onToggleCheckbox={toggleCheckbox}
                      />
                    ))}
                    <div className="flex justify-end border-t border-slate-100 pt-4">
                      {nextSection ? (
                        <button
                          type="button"
                          onClick={() => goToNextSection(section.id)}
                          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#5b4bea] px-5 text-[13px] font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-[#4f40dc]"
                        >
                          Next: {nextSection.title} {"\u2192"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => completeSection(section.id)}
                          className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#5b4bea] px-5 text-[13px] font-black text-white shadow-lg shadow-violet-600/20 transition hover:bg-[#4f40dc]"
                        >
                          {"\u2713"} Done
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
    </div>
  );
}

function QuestionField({ question, value, onChange, onToggleCheckbox }) {
  return (
    <div>
      <label className="block text-sm font-black text-slate-800">{question.label}</label>
      {question.reference && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-violet-500">
          <span className="h-3 w-3 rounded-sm border border-violet-400 bg-white" />
          {question.reference}
        </p>
      )}
      {question.type === "text" && (
        <input
          type="text"
          value={value || ""}
          onChange={(event) => onChange(question.id, event.target.value)}
          placeholder={question.placeholder}
          className="mt-2 h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
        />
      )}
      {question.type === "textarea" && (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(question.id, event.target.value)}
          placeholder={question.placeholder}
          rows={3}
          className="mt-2 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
        />
      )}
      {question.type === "select" && (
        <select
          value={value || ""}
          onChange={(event) => onChange(question.id, event.target.value)}
          className="mt-2 h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
        >
          {question.options.map((option, index) => (
            <option key={option} value={index === 0 ? "" : option}>
              {option}
            </option>
          ))}
        </select>
      )}
      {question.type === "radio" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {question.options.map((option) => (
            <label
              key={option}
              className={`inline-flex min-h-9 cursor-pointer items-center rounded border px-3 text-sm font-bold transition ${
                value === option
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={option}
                checked={value === option}
                onChange={() => onChange(question.id, option)}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      )}
      {question.type === "checkbox" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {question.options.map((option) => {
            const checked = Array.isArray(value) && value.includes(option);

            return (
              <label
                key={option}
                className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded border px-3 text-sm font-bold transition ${
                  checked
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleCheckbox(question.id, option)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                {option}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isAnswered(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}
