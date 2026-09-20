import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import BrandLogo from "../branding/BrandLogo";

const productColumns = [
  {
    title: "Go-To-Market",
    items: [
      [
        "Regulatory Intelligence",
        "Track changing rules and know what your business needs to do.",
        "/frameworks",
      ],
      [
        "Universal Basic Compliance",
        "Start a simple compliance program without building from scratch.",
        "/implementation",
      ],
      [
        "Trust Center",
        "Share security and compliance documents with customers.",
        "/trust-center",
      ],
      [
        "Requirements Management",
        "Track customer security requirements in one place.",
        "/questionnaire",
      ],
    ],
  },
  {
    title: "Compliance Operations",
    items: [
      [
        "Compliance",
        "Manage controls, policies, evidence, and audit tasks.",
        "/dashboard",
      ],
      [
        "Housekeeper AI Agent",
        "Let AI collect evidence, check tasks, and keep work moving.",
        "/assistant",
      ],
      [
        "Third-Party Risk Management",
        "Review vendors, track risks, and manage supplier reviews.",
        "/vendors",
      ],
      [
        "Security Questionnaires",
        "Answer customer security forms faster with approved answers.",
        "/questionnaire",
      ],
      [
        "Professional Services",
        "Get expert help with setup, audits, and trust workflows.",
        "/implementation",
      ],
    ],
  },
  {
    title: "Certifications & Audit",
    items: [
      ["SOC 2", "Prepare for SOC 2 with controls, evidence, and audit readiness.", "/solutions/soc2"],
      ["ISO 27001", "Build and manage an information security program.", "/solutions/iso27001"],
      ["CMMC", "Prepare for defense cybersecurity requirements.", "/solutions/cmmc"],
      ["ISO 42001", "Manage responsible AI governance and AI system controls.", "/frameworks"],
      ["CMMC 2.0", "Prepare for U.S. defense cybersecurity requirements.", "/frameworks"],
      ["FAR", "Manage federal contracting security requirements.", "/frameworks"],
      ["Custom", "Create a framework for unique customer or industry needs.", "/frameworks"],
    ],
  },
];

const solutionColumns = [
  {
    title: "By Team",
    items: [
      ["Security Teams", "/dashboard"],
      ["GRC Teams", "/frameworks"],
      ["Revenue Teams", "/trust-center"],
    ],
  },
  {
    title: "By Stage",
    items: [
      ["Startup", "/pricing"],
      ["Mid-Market", "/pricing"],
      ["Enterprise", "/pricing"],
    ],
  },
  {
    title: "By Goal",
    items: [
      ["Get Audit Ready", "/audits"],
      ["Win Enterprise Deals", "/trust-center"],
      ["Reduce Vendor Risk", "/vendors"],
    ],
  },
];

export default function Navbar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimerRef = useRef(null);
  const navRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!navRef.current?.contains(event.target)) {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const openDropdown = (id) => {
    window.clearTimeout(closeTimerRef.current);
    setOpenMenu(id);
  };

  const scheduleDropdownClose = () => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setOpenMenu(null);
    }, 220);
  };

  const closeMenus = () => {
    window.clearTimeout(closeTimerRef.current);
    setOpenMenu(null);
    setMobileOpen(false);
  };

  const handleBrandClick = () => {
    closeMenus();

    if (location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <header
      ref={navRef}
      className="sticky top-0 z-50 mx-auto mt-4 w-[min(1320px,calc(100%_-_32px))] rounded-xl border border-emerald-500/15 bg-white/88 px-3 py-3 shadow-xl shadow-slate-900/10 backdrop-blur-2xl"
    >
      <div className="grid items-center gap-4 lg:grid-cols-[auto_1fr_auto]">
        <Link
          to="/"
          className="flex min-w-max items-center rounded-lg px-2 py-1 text-slate-900 transition hover:bg-white/50"
          onClick={handleBrandClick}
        >
          <BrandLogo className="h-11 w-auto max-w-[168px] sm:max-w-[190px]" />
        </Link>

        <nav className="hidden justify-center gap-1 text-sm font-semibold text-slate-600 lg:flex">
          <MegaDropdown
            id="products"
            label="Products"
            columns={productColumns}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            openDropdown={openDropdown}
            scheduleDropdownClose={scheduleDropdownClose}
            onNavigate={closeMenus}
          />
          <MegaDropdown
            id="solutions"
            label="Solutions"
            columns={solutionColumns}
            openMenu={openMenu}
            setOpenMenu={setOpenMenu}
            openDropdown={openDropdown}
            scheduleDropdownClose={scheduleDropdownClose}
            onNavigate={closeMenus}
            compact
          />
          <NavLink to="/contact">Partners</NavLink>
          <NavLink to="/faq">Resources</NavLink>
          <NavLink to="/pricing">Plans</NavLink>
        </nav>

        <div className="hidden items-center justify-end gap-2 lg:flex">
          <button
            type="button"
            aria-label="Search"
            className="grid h-11 w-11 place-items-center rounded-lg border border-transparent text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-600/25 hover:bg-white/60 hover:text-blue-700 hover:shadow-lg hover:shadow-blue-600/10"
          >
            <Search size={18} />
          </button>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:text-blue-700"
          >
            Login
          </Link>
          <Link
            to="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#071a33] px-5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-[#0d294d]"
          >
            Book a Demo
          </Link>
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((value) => !value)}
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white/70 text-slate-900 lg:hidden"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mt-4 max-h-[calc(100vh-112px)] overflow-y-auto rounded-lg border border-blue-600/15 bg-[#fffdf8]/95 p-3 shadow-xl shadow-slate-900/10 lg:hidden">
          <MobileMega title="Products" columns={productColumns} onNavigate={closeMenus} />
          <MobileMega title="Solutions" columns={solutionColumns} onNavigate={closeMenus} compact />
          <div className="grid gap-1 border-t border-slate-200 pt-3">
            <MobileLink to="/contact" onClick={closeMenus}>Partners</MobileLink>
            <MobileLink to="/faq" onClick={closeMenus}>Resources</MobileLink>
            <MobileLink to="/pricing" onClick={closeMenus}>Plans</MobileLink>
          </div>
          <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
            <MobileLink to="/login" onClick={closeMenus}>Login</MobileLink>
            <Link
              to="/contact"
              onClick={closeMenus}
              className="rounded-lg bg-[#071a33] px-4 py-3 text-center font-bold text-white"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-10 items-center rounded-lg border border-transparent px-3 transition hover:-translate-y-0.5 hover:border-blue-600/25 hover:bg-white/60 hover:text-blue-700 hover:shadow-lg hover:shadow-blue-600/10"
    >
      {children}
    </Link>
  );
}

function MegaDropdown({
  id,
  label,
  columns,
  openMenu,
  setOpenMenu,
  openDropdown,
  scheduleDropdownClose,
  onNavigate,
  compact = false,
}) {
  const isOpen = openMenu === id;

  return (
    <div
      className="static"
      onMouseEnter={() => openDropdown(id)}
      onMouseLeave={scheduleDropdownClose}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpenMenu(isOpen ? null : id)}
        className="inline-flex min-h-10 items-center rounded-lg border border-transparent px-3 transition hover:-translate-y-0.5 hover:border-blue-600/25 hover:bg-white/60 hover:text-blue-700 hover:shadow-lg hover:shadow-blue-600/10"
      >
        {label}
        <ChevronDown
          size={15}
          className={`ml-2 transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-1/2 top-[calc(100%-1px)] z-50 w-[min(1080px,calc(100vw_-_32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-white/85 bg-[linear-gradient(135deg,rgba(255,253,248,.98),rgba(239,234,223,.97))] p-5 shadow-2xl shadow-slate-900/20"
          onMouseEnter={() => openDropdown(id)}
          onMouseLeave={scheduleDropdownClose}
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {columns.map((column, index) => (
              <section
                key={column.title}
                className={`grid content-start gap-2 ${index < columns.length - 1 ? "border-r border-slate-200 pr-5" : ""}`}
              >
                <h3 className="mb-1 flex items-center justify-between text-base font-black text-slate-900">
                  {column.title}
                  <span className="text-blue-700">-&gt;</span>
                </h3>
                {column.items.map(([title, description, href]) => (
                  <Link
                    key={title}
                    to={href}
                    onClick={onNavigate}
                    className="group grid gap-1 rounded-lg border border-transparent p-2.5 transition hover:-translate-y-0.5 hover:border-blue-600/20 hover:bg-white/70 hover:shadow-lg hover:shadow-blue-600/10"
                  >
                    <span className="text-sm font-black text-slate-900 transition group-hover:text-blue-700">
                      {title}
                    </span>
                    {!compact && description && (
                      <span className="text-xs leading-5 text-slate-500 transition group-hover:text-slate-700">
                        {description}
                      </span>
                    )}
                  </Link>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileMega({ title, columns, onNavigate, compact = false }) {
  return (
    <div className="border-b border-slate-200 pb-3">
      <p className="px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700">
        {title}
      </p>
      <div className="grid gap-3">
        {columns.map((column) => (
          <div key={column.title} className="rounded-lg bg-white/55 p-3">
            <p className="mb-2 text-sm font-black text-slate-900">{column.title}</p>
            <div className="grid gap-1">
              {column.items.map(([itemTitle, description, href]) => (
                <Link
                  key={itemTitle}
                  to={href}
                  onClick={onNavigate}
                  className="rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-100 hover:text-blue-800"
                >
                  {itemTitle}
                  {!compact && description && (
                    <span className="mt-1 block text-xs font-medium leading-5 text-slate-500">
                      {description}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileLink({ to, onClick, children }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="rounded-lg px-4 py-3 font-bold text-slate-800 transition hover:bg-blue-100 hover:text-blue-800"
    >
      {children}
    </Link>
  );
}
