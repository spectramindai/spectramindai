import { Link } from "react-router-dom";
import { Building2 } from "lucide-react";
import { APP_NAME } from "../core/adapters/useOrganizationBranding";
import BrandLogo from "./branding/BrandLogo";
import ComplianceBadgesRow from "./compliance/ComplianceBadges";

function GithubIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function TwitterXIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function YoutubeIcon({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export default function Footer() {
  const brandName = APP_NAME || "Compvd.ai";

  return (
    <footer className="border-t border-slate-200/80 bg-white text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-12 lg:px-8">
        {/* Main Grid: Left Company Info + Right Multi-column Links */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Company Brand, Description, Address & Socials (matches Picture 3 & 4) */}
          <div className="space-y-6 lg:col-span-4 lg:pr-8">
            <Link to="/" className="inline-block focus:outline-none">
              <BrandLogo className="h-10 w-auto" />
            </Link>

            <p className="max-w-sm text-sm leading-relaxed text-slate-600">
              AI-powered compliance platform. Get SOC 2, ISO 27001, CMMC and
              TISAX audit-ready in record time.
            </p>

            {/* Address Section (matches Picture 3 layout with user's details) */}
            <div className="space-y-4 pt-1">
              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      HYDERABAD
                    </span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      HQ
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600 leading-snug">
                    Born in Hyderabad, Telangana, INDIA.
                  </p>
                  <p className="text-sm font-semibold text-slate-700">
                    Built for the World. 🇮🇳
                  </p>
                </div>
              </div>
            </div>

            {/* Social Icons (matches Picture 3) */}
            <div className="flex items-center gap-4 pt-2 text-slate-500">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-slate-900"
                aria-label="GitHub"
              >
                <GithubIcon className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-slate-900"
                aria-label="X (Twitter)"
              >
                <TwitterXIcon className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-slate-900"
                aria-label="LinkedIn"
              >
                <LinkedinIcon className="h-4 w-4" />
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-slate-900"
                aria-label="YouTube"
              >
                <YoutubeIcon className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Navigation Links Grid (matches Picture 3 & Picture 4) */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5 lg:col-span-8">
            {/* Product */}
            <FooterGroup title="Product">
              <FooterLink to="/testimonials">How it works</FooterLink>
              <FooterLink to="/dashboard">Platform</FooterLink>
              <FooterLink to="/contact">Book a Demo</FooterLink>
              <FooterLink to="/pricing">Pricing</FooterLink>
              <FooterLink to="/integrations">Integrations</FooterLink>
            </FooterGroup>

            {/* Resources */}
            <FooterGroup title="Resources">
              <FooterLink to="/testimonials">Case Studies</FooterLink>
              <FooterLink to="/frameworks">Compliance Hub</FooterLink>
              <FooterLink to="/evidence">Tools & Templates</FooterLink>
              <FooterLink to="/implementation">Documentation</FooterLink>
              <FooterLink to="/trust-center">Trust Center</FooterLink>
              <FooterLink to="/audits">Security</FooterLink>
              <FooterLink to="/about">Careers</FooterLink>
              <FooterLink to="/contact">Partnerships</FooterLink>
            </FooterGroup>

            {/* Guides */}
            <FooterGroup title="Guides">
              <FooterLink to="/solutions/soc2">SOC 2 Cost</FooterLink>
              <FooterLink to="/solutions/soc2">SOC 2 Checklist</FooterLink>
              <FooterLink to="/solutions/soc2">SOC 2 for Startups</FooterLink>
              <FooterLink to="/solutions/soc2">SOC 1 vs SOC 2</FooterLink>
              <FooterLink to="/solutions/iso27001">ISO 27001 Guide</FooterLink>
              <FooterLink to="/solutions/cmmc">CMMC 2.0 Guide</FooterLink>
              <FooterLink to="/frameworks">GRC Automation</FooterLink>
            </FooterGroup>

            {/* Compare */}
            <FooterGroup title="Compare">
              <FooterLink to="/pricing">Vanta Pricing</FooterLink>
              <FooterLink to="/pricing">Drata Pricing</FooterLink>
              <FooterLink to="/pricing">Secureframe Pricing</FooterLink>
              <FooterLink to="/pricing">Drata vs Vanta</FooterLink>
              <FooterLink to="/pricing">Vanta Competitors</FooterLink>
              <FooterLink to="/pricing">Drata Competitors</FooterLink>
            </FooterGroup>

            {/* Legal */}
            <FooterGroup title="Legal">
              <FooterLink to="/trust-center">Legal Overview</FooterLink>
              <FooterLink to="/faq">Terms</FooterLink>
              <FooterLink to="/faq">Privacy</FooterLink>
              <FooterLink to="/faq">Cookies</FooterLink>
              <FooterLink to="/faq">DPA</FooterLink>
              <FooterLink to="/faq">SLA</FooterLink>
              <FooterLink to="/vendors">Subprocessors</FooterLink>
            </FooterGroup>
          </div>
        </div>

        {/* Bottom Section: Badges + Copyright + Status Indicator (matches Picture 2 & 4) */}
        <div className="mt-16 pt-8 border-t border-slate-200">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            {/* Left: Badges Row + Copyright below */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ComplianceBadgesRow badgeHeight="h-11 sm:h-12" />
              </div>
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
              </p>
            </div>

            {/* Right: Systems Status Pill (matches Picture 2 & 4) */}
            <div className="flex items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>All Systems Normal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-900">
        {title}
      </h3>
      <ul className="space-y-2 text-xs text-slate-600">
        {children}
      </ul>
    </div>
  );
}

function FooterLink({ to, children }) {
  const isExternal = to.startsWith("http");

  if (isExternal) {
    return (
      <li>
        <a
          href={to}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-emerald-700"
        >
          {children}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={to}
        className="transition-colors hover:text-emerald-700"
      >
        {children}
      </Link>
    </li>
  );
}
