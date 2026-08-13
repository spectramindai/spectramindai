import { Navigate, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Signup from "./pages/Signup";
import OrganizationSetup from "./pages/OrganizationSetup";
import JoinOrganization from "./pages/JoinOrganization";

import Frameworks from "./pages/Frameworks";
import Evidence from "./pages/Evidence";
import Vendors from "./pages/Vendors";
import Questionnaire from "./pages/Questionnaire";
import Implementation from "./pages/Implementation";
import MandatoryDocumentUpload from "./pages/MandatoryDocumentUpload";
import Training from "./pages/Training";
import TrainingDetails from "./pages/TrainingDetails";
import Employees from "./pages/Employees";
import Integrations from "./pages/Integrations";
import Audits from "./pages/Audits";
import Comments from "./pages/Comments";
import Tasks from "./pages/Tasks";

import TrustCenter from "./pages/TrustCenter";
import Settings from "./pages/Settings";
import SOC2 from "./pages/SOC2";

import ControlDetails from "./pages/ControlDetails";
import Policies from "./pages/Policies";
import PolicyDocument from "./pages/PolicyDocument";

import Assistant from "./pages/Assistant";

import ProfileSettings from "./pages/ProfileSettings";  
import Profile from "./pages/Profile";

import About from "./pages/About";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";

import PricingPage from "./pages/PricingPage";
import Testimonials from "./pages/Testimonials";

import SOC2Solution from "./pages/SOC2Solution";
import ISO27001Solution from "./pages/ISO27001Solution";
import CMMCSolution from "./pages/CMMCSolution";
import { cmmcWorkspaceRoutes } from "./features/cmmc/routes";
import ProtectedRoute from "./auth/ProtectedRoute";
import { OnboardingRequired } from "./auth/WorkspaceAccess";
import ActiveFrameworkOutlet from "./framework/ActiveFrameworkOutlet";

function App() {
  return (
    <Routes>
      <Route
  path="/test"
  element={<h1 style={{fontSize:"50px"}}>TEST PAGE</h1>}
/>

<Route path="/about" element={<About />} />
<Route path="/faq" element={<FAQ />} />
<Route path="/contact" element={<Contact />} />

<Route
  path="/pricing"
  element={<PricingPage />}
/>

<Route
  path="/testimonials"
  element={<Testimonials />}
/>

<Route
  path="/solutions/soc2"
  element={<SOC2Solution />}
/>

<Route
  path="/solutions/iso27001"
  element={<ISO27001Solution />}
/>

<Route
  path="/solutions/cmmc"
  element={<CMMCSolution />}
/>

      <Route
        path="/"
        element={<Landing />}
      />

      <Route
        path="/login"
        element={<Login />}
      />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/onboarding/organization" element={<OrganizationSetup />} />
        <Route path="/join-organization" element={<JoinOrganization />} />
        <Route element={<OnboardingRequired />}>
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile-settings" element={<ProfileSettings />} />
        <Route path="/frameworks" element={<Frameworks />} />
        <Route element={<ActiveFrameworkOutlet />}>
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/risks" element={<Navigate to="/implementation?itemType=Risk" replace />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/questionnaire" element={<Questionnaire />} />
          <Route path="/implementation" element={<Implementation />} />
          <Route path="/implementation/mandatory-documents/:documentId/upload" element={<MandatoryDocumentUpload />} />
          <Route path="/training" element={<Training />} />
          <Route path="/training/:trainingId" element={<TrainingDetails />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/audits" element={<Audits />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/policies/:policyId/document" element={<PolicyDocument />} />
          <Route path="/assistant" element={<Assistant />} />
        </Route>
        <Route path="/trust-center" element={<TrustCenter />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/soc2" element={<SOC2 />} />
        <Route path="/implementation/soc2" element={<SOC2 />} />
        <Route path="/control/:id" element={<ControlDetails />} />
        <Route element={<ActiveFrameworkOutlet frameworkSlug="cmmc" />}>
          {cmmcWorkspaceRoutes.map(({ path, Component }) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
        </Route>
        <Route path="/dashboard" element={<Dashboard />} />
        </Route>
      </Route>

    </Routes>
  );
}

export default App;
