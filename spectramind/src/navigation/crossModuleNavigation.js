import { CMMC_FRAMEWORK_ID, resolveFrameworkId } from "../core/engines/framework-engine/frameworkRegistry";

const IMPLEMENTATION_TYPES = new Set(["Control", "Test", "Implementation", "Population", "Risk"]);

const MODULE_PATHS = {
  Control: "/implementation",
  Test: "/implementation",
  Implementation: "/implementation",
  Population: "/implementation",
  Risk: "/implementation",
  Policy: "/policies",
  Evidence: "/evidence",
  Questionnaire: "/questionnaire",
  Task: "/tasks",
  Training: "/training",
  Audit: "/audits",
};

const CMMC_MODULE_PATHS = {
  Scope: "/cmmc/scope",
  Organization: "/cmmc/organization",
  "Gap Wizard": "/cmmc/gap-wizard",
  SPRS: "/cmmc/sprs-score",
  Auditor: "/cmmc/auditor",
  Evidence: "/cmmc/evidence",
  Policy: "/policies",
  "Policy Documents": "/policies",
  Control: "/cmmc/controls",
  Test: "/cmmc/assessment-objectives",
  Implementation: "/cmmc/organization",
  Population: "/cmmc/organization",
  Risk: "/cmmc/organization",
  Questionnaire: "/cmmc/scope",
  Training: "/training",
  Task: "/tasks",
};

export function buildCrossModuleTarget({ activeFramework, itemId, itemType, moduleContext = "", mode = "view" }) {
  const normalizedType = normalizeItemType(itemType);
  // Routes identify a framework by its public slug (for example `soc-2`),
  // while the engine uses an internal id (for example `soc2-type-ii`).
  // Prefer the slug so destination pages can resolve the selected framework
  // before applying the exact item deep link.
  const frameworkId = activeFramework?.slug || activeFramework?.id || activeFramework || "";
  const path = isCMMCFramework(frameworkId)
    ? getCMMCModulePath(normalizedType, itemId, moduleContext)
    : MODULE_PATHS[normalizedType] || "/implementation";
  const params = new URLSearchParams({
    framework: frameworkId,
    item: itemId || "",
    itemType: normalizedType,
    moduleContext,
    auditMode: mode,
  });

  if (IMPLEMENTATION_TYPES.has(normalizedType)) {
    params.set("itemId", itemId || "");
  }

  return {
    path: `${path}?${params.toString()}`,
    state: {
      activeFramework,
      relatedItemId: itemId,
      itemType: normalizedType,
      moduleContext,
      auditMode: mode,
      readOnly: mode === "view",
      missingRecordMessage: "The linked record is no longer available. Use this module to locate the current replacement.",
    },
  };
}

export function normalizeItemType(itemType = "") {
  const normalized = String(itemType).trim();
  return {
    Controls: "Control",
    Tests: "Test",
    Implementations: "Implementation",
    Policies: "Policy",
    Risks: "Risk",
    EvidenceRequirements: "Evidence",
    Tasks: "Task",
    "Policy Document": "Policy Documents",
    "Policy Documents": "Policy Documents",
    "SPRS Score": "SPRS",
    "SPRS": "SPRS",
    "Audit Readiness": "Auditor",
    "Audits": "Audit",
  }[normalized] || normalized || "Implementation";
}

export function implementationTabForItemType(itemType, fallback = "Tests") {
  return {
    Control: "Controls",
    Test: "Tests",
    Risk: "Risk Scenarios",
    Policy: "Policies",
    Implementation: "Populations",
    Population: "Populations",
  }[normalizeItemType(itemType)] || fallback;
}

function isCMMCFramework(frameworkId) {
  return resolveFrameworkId(frameworkId) === CMMC_FRAMEWORK_ID;
}

function getCMMCModulePath(normalizedType, itemId, moduleContext) {
  if (normalizedType === "Audit") {
    const normalizedItemId = String(itemId || "").toLowerCase();
    const normalizedContext = String(moduleContext || "").toLowerCase();

    if (normalizedItemId.includes("compliance-score") || normalizedContext.includes("compliance percentage")) {
      return "/cmmc/sprs-score";
    }

    if (normalizedItemId.includes("activity") || normalizedContext.includes("recent activity")) {
      return "/cmmc/auditor";
    }

    return "/cmmc/auditor";
  }

  return CMMC_MODULE_PATHS[normalizedType] || MODULE_PATHS[normalizedType] || "/cmmc/scope";
}
