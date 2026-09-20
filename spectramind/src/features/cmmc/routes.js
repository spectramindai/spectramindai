import { createElement } from "react";
import { Navigate } from "react-router-dom";
import CMMCUploadedEvidencePage from "./pages/CMMCUploadedEvidencePage";
import CMMCOperationsPage from "./pages/CMMCOperationsPage";
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
  CMMCScopePage,
  CMMCSPRSScorePage,
} from "./pages";

export const cmmcWorkspaceRoutes = [
  { path: "/cmmc/operations/:moduleId", Component: CMMCOperationsPage },
  { path: "/cmmc/uploaded-evidence", Component: CMMCUploadedEvidencePage },
  { path: "/cmmc", Component: CMMCScopePage },
  { path: "/cmmc/scope", Component: CMMCScopePage },
  { path: "/cmmc/overview", Component: CMMCOverviewRedirect },
  { path: "/cmmc/organization", Component: CMMCOrganizationPage },
  { path: "/cmmc/gap-wizard", Component: CMMCGapWizardPage },
  { path: "/cmmc/auditor", Component: CMMCAuditorPage },
  { path: "/cmmc/evidence", Component: CMMCEvidencePage },
  { path: "/cmmc/ssp", Component: CMMCEvidencePage },
  { path: "/cmmc/poam", Component: CMMCEvidencePage },
  { path: "/cmmc/policies", Component: CMMCEvidencePage },
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

function CMMCOverviewRedirect() {
  return createElement(Navigate, { to: "/dashboard?framework=cmmc", replace: true });
}
