import { Link } from "react-router-dom";
import { APP_NAME } from "../core/adapters/useOrganizationBranding";

export default function Footer() {
  return (
    <footer className="border-t border-white/70 bg-[#fffdf8]/72 py-14 text-slate-900 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <h2 className="text-3xl font-black">
              {APP_NAME}
            </h2>
            <p className="mt-4 max-w-sm leading-relaxed text-slate-600">
              A unified platform for compliance management, evidence
              collection, risk monitoring, vendor oversight, and trust
              reporting.
            </p>
          </div>

          <FooterGroup title="Solutions">
            <FooterLink to="/solutions/soc2">SOC 2 Compliance</FooterLink>
            <FooterLink to="/solutions/iso27001">ISO 27001</FooterLink>
            <FooterLink to="/solutions/cmmc">CMMC</FooterLink>
          </FooterGroup>

          <FooterGroup title="Resources">
            <FooterLink to="/about">About</FooterLink>
            <FooterLink to="/faq">FAQs</FooterLink>
            <FooterLink to="/contact">Contact</FooterLink>
          </FooterGroup>

          <FooterGroup title="Product">
            <FooterLink to="/testimonials">View Product</FooterLink>
            <FooterLink to="/login">Login</FooterLink>
            <FooterLink to="/pricing">Plans</FooterLink>
          </FooterGroup>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-200 pt-7 md:flex-row md:items-center">
          <p className="text-sm text-slate-500">
            &copy; 2026 {APP_NAME}. All rights reserved.
          </p>
          <p className="text-sm text-slate-500">
            Built for modern compliance teams.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-black">
        {title}
      </h3>
      <div className="space-y-3 text-slate-600">
        {children}
      </div>
    </div>
  );
}

function FooterLink({ to, children }) {
  return (
    <Link to={to} className="block transition hover:text-blue-700">
      {children}
    </Link>
  );
}
