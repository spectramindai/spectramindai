import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "./UserContext";
import { getApiSession, isApiEnabled } from "../api/client";

export default function ProtectedRoute() {
  const { isAuthenticated } = useUser();
  const location = useLocation();

  if (!isAuthenticated || (isApiEnabled && !getApiSession()?.token)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
