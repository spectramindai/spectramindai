import { useParams } from "react-router-dom";
import CMMCOperationalModulePage from "./CMMCOperationalModulePage";

export default function CMMCDomainPage() {
  const { domainId = "" } = useParams();
  return <CMMCOperationalModulePage moduleId="domain-details" domainId={domainId} />;
}
