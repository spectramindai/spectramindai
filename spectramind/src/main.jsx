import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { UserProvider } from "./auth/UserContext";
import { ComplianceStateProvider } from "./compliance/ComplianceStateContext";
import { FrameworkWorkspaceProvider } from "./framework/FrameworkWorkspaceContext";
import "./index.css";
import ApiConfigurationGuard from "./components/ApiConfigurationGuard";

document.documentElement.classList.remove("dark");
localStorage.removeItem("darkMode");

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <ApiConfigurationGuard>
        <UserProvider>
          <FrameworkWorkspaceProvider>
            <ComplianceStateProvider>
              <App />
            </ComplianceStateProvider>
          </FrameworkWorkspaceProvider>
        </UserProvider>
      </ApiConfigurationGuard>
    </BrowserRouter>
  </React.StrictMode>
);
