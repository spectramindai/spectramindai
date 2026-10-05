import { Navigate } from "react-router-dom";

export default function CMMCAuditReadinessPage() {
  return <Navigate to="/audits?framework=cmmc" replace />;
}
