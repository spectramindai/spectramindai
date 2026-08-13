import { createElement } from "react";
import { Navigate } from "react-router-dom";
import {
  CMMCAssessmentObjectivesPage,
  CMMCAuditReadinessPage,
  CMMCAuditorPage,
  CMMCControlsPage,
  CMMCDomainPage,
  CMMCDomainSummaryPage,
  CMMCEvidencePage,
  CMMCGapWizardPage,
  CMMCOrganizationPage,
  CMMCOverviewPage,
  CMMCPOAMPage,
  CMMCPoliciesPage,
  CMMCScopePage,
  CMMCSPRSScorePage,
  CMMCSSPPage,
} from "./pages";

export const cmmcWorkspaceRoutes = [
  { path: "/cmmc", Component: CMMCScopePage },
  { path: "/cmmc/scope", Component: CMMCScopePage },
  { path: "/cmmc/overview", Component: CMMCOverviewPage },
  { path: "/cmmc/organization", Component: CMMCOrganizationPage },
  { path: "/cmmc/gap-wizard", Component: CMMCGapWizardPage },
  { path: "/cmmc/auditor", Component: CMMCAuditorPage },
  { path: "/cmmc/evidence", Component: CMMCEvidencePage },
  { path: "/cmmc/ssp", Component: CMMCSSPPage },
  { path: "/cmmc/poam", Component: CMMCPOAMPage },
  { path: "/cmmc/policies", Component: CMMCPoliciesPage },
  { path: "/cmmc/domains", Component: CMMCDomainSummaryPage },
  { path: "/cmmc/domains/:domainId", Component: CMMCDomainPage },
  { path: "/cmmc/controls", Component: CMMCControlsPage },
  { path: "/cmmc/assessment-objectives", Component: CMMCAssessmentObjectivesPage },
  { path: "/cmmc/sprs-score", Component: CMMCSPRSScorePage },
  { path: "/cmmc/audit-readiness", Component: CMMCAuditReadinessPage },
  { path: "/cmmc/*", Component: CMMCRouteFallback },
];

function CMMCRouteFallback() {
  return createElement(Navigate, { to: "/cmmc/organization", replace: true });
}
