import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUser } from "./UserContext";

export default function ProtectedRoute() {
  const { isAuthenticated } = useUser();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
