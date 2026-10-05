import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "./UserContext";
import { canManageWorkspace } from "./session";

export function OnboardingRequired() {
  const { user } = useUser();
  const location = useLocation();
  const hasOrganizationWorkspace = Boolean(user?.onboardingComplete && user?.organizationId);
  if (!hasOrganizationWorkspace && location.pathname !== "/dashboard") {
    return <Navigate to={canManageWorkspace(user?.role) ? "/onboarding/organization" : "/join-organization"} replace state={{ from: location, setupRequired: true }} />;
  }
  return <Outlet />;
}

export function ManagerRequired() {
  const { user } = useUser();
  if (!canManageWorkspace(user?.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
