import {
  ArrowUpDown,
  ChevronRight,
  Database,
  Download,
  FileUp,
  FileText,
  Filter,
  Layers,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import AppShell from "../components/layout/AppShell";
import {
  soc2Controls,
  soc2Populations,
  soc2RiskScenarios,
  soc2Summary,
  soc2Tests,
} from "../data/soc2Framework";

const tabs = [
  { key: "risks", label: "Risk Scenarios" },
  { key: "controls", label: "Controls" },
  { key: "tests", label: "Tests" },
  { key: "populations", label: "Populations" },
];

const tabData = {
  risks: soc2RiskScenarios,
  controls: soc2Controls,
  tests: soc2Tests,
  populations: soc2Populations,
};

const overviewStats = [
  {
    label: "Risk Scenarios",
    value: soc2Summary.riskScenarioCount,
    detail: `${soc2Summary.trustCriteriaCount} SOC 2 criteria mapped`,
    icon: Target,
  },
  {
    label: "Tests",
    value: soc2Summary.testCount,
    detail: "Evidence requests generated from controls",
    icon: FileText,
  },
  {
    label: "Controls",
    value: soc2Summary.controlCount,
    detail: "Imported from the SOC 2 Type II mapping",
    icon: ShieldCheck,
  },
  {
    label: "Populations",
    value: soc2Summary.populationCount,
    detail: "Audit sampling groups",
    icon: Database,
  },
];

const sortOptions = [
  { value: "id", label: "ID" },
  { value: "title", label: "Title" },
  { value: "category", label: "Category" },
];

export default function SOC2() {
  const [activeTab, setActiveTab] = useState("controls");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("id");
  const [selectedItem, setSelectedItem] = useState(soc2Controls[0]);
  const [evidenceByControl, setEvidenceByControl] = useState({});

  const uploadEvidence = (controlId, fileList) => {
    const files = Array.from(fileList || []);

    if (!controlId || files.length === 0) return;

    const uploaded = files.map((file) => ({
      id: `${controlId}-${file.name}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || "Evidence file",
      uploadedAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    }));

    setEvidenceByControl((current) => ({
      ...current,
      [controlId]: [...(current[controlId] || []), ...uploaded],
    }));
  };

  const removeEvidence = (controlId, evidenceId) => {
    setEvidenceByControl((current) => ({
      ...current,
      [controlId]: (current[controlId] || []).filter((item) => item.id !== evidenceId),
    }));
  };

  const rows = tabData[activeTab];
  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        const matchesCategory = category === "All" || row.category === category;
        const matchesQuery =
          !normalizedQuery || searchableText(row).includes(normalizedQuery);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => compareRows(a, b, sortBy));
  }, [category, query, rows, sortBy]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-blue-700/80">
              Compliance Implementation
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black text-slate-950">SOC 2</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/20 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-800">
                Type II
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Centralized SOC 2 implementation workspace for mapped risks,
              controls, evidence tests, and audit populations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/74 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-white"
            >
              <Layers size={16} />
              Description of System
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-white/80 bg-white/72 p-5 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-black text-slate-800"
              >
                <ChevronRight size={16} className="rotate-90 text-slate-500" />
                Overview
              </button>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Progress across risk scenarios, tests, controls, and audit
                population coverage.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {overviewStats.map((stat) => (
                <OverviewMetric key={stat.label} stat={stat} />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/80 bg-white/76 shadow-xl shadow-slate-900/5 backdrop-blur">
          <div className="border-b border-slate-200/70 px-5 pt-4">
            <div className="flex flex-wrap gap-5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSelectedItem(tabData[tab.key][0]);
                  }}
                  className={`border-b-2 px-1 pb-3 text-sm font-black transition ${
                    activeTab === tab.key
                      ? "border-blue-700 text-blue-800"
                      : "border-transparent text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-200/70 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500"
                  placeholder="Search by title, ID, owner, criterion, or keyword"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <details className="relative">
                  <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <Filter size={16} />
                    {category === "All" ? "All categories" : category}
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                    {["All", ...soc2Summary.categories].map((item) => (
                      <CheckedMenuRow
                        key={item}
                        active={category === item}
                        onClick={() => setCategory(item)}
                      >
                        {item === "All" ? "All categories" : item}
                      </CheckedMenuRow>
                    ))}
                  </div>
                </details>

                <details className="relative">
                  <summary className="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <ArrowUpDown size={16} />
                    Sort by {sortOptions.find((option) => option.value === sortBy)?.label || "control ID"}
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                    {sortOptions.map((option) => (
                      <CheckedMenuRow
                        key={option.value}
                        active={sortBy === option.value}
                        onClick={() => setSortBy(option.value)}
                      >
                        Sort by {option.label}
                      </CheckedMenuRow>
                    ))}
                  </div>
                </details>

                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <SlidersHorizontal size={16} />
                  Settings
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-h-[520px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-x-auto">
              {activeTab === "controls" && (
                <ControlsTable
                  rows={visibleRows}
                  onSelect={setSelectedItem}
                  evidenceByControl={evidenceByControl}
                />
              )}
              {activeTab === "risks" && (
                <RisksTable rows={visibleRows} onSelect={setSelectedItem} />
              )}
              {activeTab === "tests" && (
                <TestsTable rows={visibleRows} onSelect={setSelectedItem} />
              )}
              {activeTab === "populations" && (
                <PopulationsTable rows={visibleRows} onSelect={setSelectedItem} />
              )}
            </div>

            <DetailPanel
              activeTab={activeTab}
              item={selectedItem}
              evidenceByControl={evidenceByControl}
              onUploadEvidence={uploadEvidence}
              onRemoveEvidence={removeEvidence}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function OverviewMetric({ stat }) {
  const Icon = stat.icon;

  return (
    <div className="min-w-44 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            {stat.label}
          </p>
          <p className="mt-1 text-3xl font-black text-slate-950">
            {stat.value}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {stat.detail}
      </p>
    </div>
  );
}

function ControlsTable({ rows, onSelect, evidenceByControl }) {
  return (
    <TableShell
      headers={["ID", "Title", "Status", "Uploads", "Owner", "Frequency", "Criteria", "Category"]}
    >
      {rows.map((control, index) => (
        <tr key={`${control.id}-${index}`} className="border-b border-slate-100 last:border-0">
          <Cell strong>
            <button
              type="button"
              onClick={() => onSelect(control)}
              className="font-black text-blue-700 hover:text-blue-900"
            >
              {control.id}
            </button>
          </Cell>
          <Cell>
            <button
              type="button"
              onClick={() => onSelect(control)}
              className="max-w-xl text-left font-bold text-slate-800 hover:text-blue-800"
            >
              {control.title}
            </button>
            <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-500">
              {control.description}
            </p>
          </Cell>
          <Cell>
            <StatusPill>{control.status}</StatusPill>
          </Cell>
          <Cell>
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">
              {(evidenceByControl[control.id] || []).length} files
            </span>
          </Cell>
          <Cell>{control.owner}</Cell>
          <Cell>{control.frequency}</Cell>
          <Cell>
            <CriteriaList items={control.criteria} />
          </Cell>
          <Cell>{control.category}</Cell>
        </tr>
      ))}
    </TableShell>
  );
}

function RisksTable({ rows, onSelect }) {
  return (
    <TableShell
      headers={["ID", "Risk Scenario", "Trust ID", "Severity", "Controls", "Category"]}
    >
      {rows.map((risk, index) => (
        <tr key={`${risk.id}-${index}`} className="border-b border-slate-100 last:border-0">
          <Cell strong>
            <button
              type="button"
              onClick={() => onSelect(risk)}
              className="font-black text-blue-700 hover:text-blue-900"
            >
              {risk.id}
            </button>
          </Cell>
          <Cell>
            <button
              type="button"
              onClick={() => onSelect(risk)}
              className="max-w-xl text-left font-bold text-slate-800 hover:text-blue-800"
            >
              {risk.title}
            </button>
            <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-500">
              {risk.description}
            </p>
          </Cell>
          <Cell>{risk.trustId}</Cell>
          <Cell>
            <SeverityPill value={risk.severity} />
          </Cell>
          <Cell>{risk.linkedControls.length}</Cell>
          <Cell>{risk.category}</Cell>
        </tr>
      ))}
    </TableShell>
  );
}

function TestsTable({ rows, onSelect }) {
  return (
    <TableShell
      headers={["ID", "Title", "Status", "Assigned To", "Evidence", "Control", "Category"]}
    >
      {rows.map((test, index) => (
        <tr key={`${test.id}-${index}`} className="border-b border-slate-100 last:border-0">
          <Cell strong>
            <button
              type="button"
              onClick={() => onSelect(test)}
              className="font-black text-blue-700 hover:text-blue-900"
            >
              {test.id}
            </button>
          </Cell>
          <Cell>
            <button
              type="button"
              onClick={() => onSelect(test)}
              className="max-w-xl text-left font-bold text-slate-800 hover:text-blue-800"
            >
              {test.title}
            </button>
            <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-500">
              {test.description}
            </p>
          </Cell>
          <Cell>
            <StatusPill>{test.status}</StatusPill>
          </Cell>
          <Cell>{test.assignedTo}</Cell>
          <Cell>{test.evidenceType}</Cell>
          <Cell>{test.controlId}</Cell>
          <Cell>{test.category}</Cell>
        </tr>
      ))}
    </TableShell>
  );
}

function PopulationsTable({ rows, onSelect }) {
  return (
    <TableShell headers={["ID", "Population", "Source", "Period", "Controls"]}>
      {rows.map((population, index) => (
        <tr key={`${population.id}-${index}`} className="border-b border-slate-100 last:border-0">
          <Cell strong>
            <button
              type="button"
              onClick={() => onSelect(population)}
              className="font-black text-blue-700 hover:text-blue-900"
            >
              {population.id}
            </button>
          </Cell>
          <Cell>
            <button
              type="button"
              onClick={() => onSelect(population)}
              className="max-w-xl text-left font-bold text-slate-800 hover:text-blue-800"
            >
              {population.name}
            </button>
            <p className="mt-1 line-clamp-2 max-w-xl text-xs leading-5 text-slate-500">
              {population.description}
            </p>
          </Cell>
          <Cell>{population.source}</Cell>
          <Cell>{population.period}</Cell>
          <Cell>{population.count}</Cell>
        </tr>
      ))}
    </TableShell>
  );
}

function TableShell({ headers, children }) {
  return (
    <table className="min-w-[980px] w-full border-collapse text-left text-sm">
      <thead className="bg-slate-50/90 text-xs font-black uppercase tracking-wider text-slate-500">
        <tr>
          {headers.map((header) => (
            <th key={header} className="border-b border-slate-200 px-4 py-3">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white/60">{children}</tbody>
    </table>
  );
}

function Cell({ children, strong = false }) {
  return (
    <td
      className={`px-4 py-3 align-top ${
        strong ? "font-black text-slate-900" : "font-semibold text-slate-600"
      }`}
    >
      {children}
    </td>
  );
}

function StatusPill({ children }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
      {children}
    </span>
  );
}

function SeverityPill({ value }) {
  const tone =
    value === "High"
      ? "bg-rose-50 text-rose-700"
      : value === "Medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tone}`}>
      {value}
    </span>
  );
}

function CriteriaList({ items }) {
  return (
    <div className="flex max-w-56 flex-wrap gap-1.5">
      {items.slice(0, 3).map((item) => (
        <span
          key={item}
          className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700"
        >
          {item}
        </span>
      ))}
      {items.length > 3 && (
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
          +{items.length - 3}
        </span>
      )}
    </div>
  );
}

function DetailPanel({ activeTab, item, evidenceByControl, onUploadEvidence, onRemoveEvidence }) {
  if (!item) {
    return (
      <aside className="border-t border-slate-200 bg-slate-50/80 p-5 xl:border-l xl:border-t-0">
        <p className="text-sm font-bold text-slate-500">No row selected.</p>
      </aside>
    );
  }

  return (
    <aside className="border-t border-slate-200 bg-slate-50/80 p-5 xl:border-l xl:border-t-0">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        Details
      </p>
      <h2 className="mt-2 text-xl font-black text-slate-950">
        {detailTitle(activeTab, item)}
      </h2>

      <div className="mt-5 space-y-4">
        {activeTab === "controls" && (
          <ControlDetails
            item={item}
            evidenceFiles={evidenceByControl[item.id] || []}
            onUploadEvidence={onUploadEvidence}
            onRemoveEvidence={onRemoveEvidence}
          />
        )}
        {activeTab === "risks" && <RiskDetails item={item} />}
        {activeTab === "tests" && <TestDetails item={item} />}
        {activeTab === "populations" && <PopulationDetails item={item} />}
      </div>
    </aside>
  );
}

function ControlDetails({ item, evidenceFiles, onUploadEvidence, onRemoveEvidence }) {
  return (
    <>
      <DetailBlock label="Mapped Criterion" value={`${item.trustId} - ${item.principle}`} />
      <DetailBlock label="Control Description" value={item.description} />
      <DetailBlock label="Owner" value={item.owner} />
      <DetailBlock label="Frequency" value={item.frequency} />
      <DetailBlock label="Evidence Type" value={item.evidenceType} />
      <EvidenceUpload
        control={item}
        evidenceFiles={evidenceFiles}
        onUploadEvidence={onUploadEvidence}
        onRemoveEvidence={onRemoveEvidence}
      />
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Linked Criteria
        </p>
        <div className="mt-2">
          <CriteriaList items={item.criteria} />
        </div>
      </div>
      <DetailBlock label="Control Focus" value={item.focus} preline />
    </>
  );
}

function EvidenceUpload({ control, evidenceFiles, onUploadEvidence, onRemoveEvidence }) {
  return (
    <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-blue-700">
          Evidence Upload
        </p>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
          Upload evidence directly against {control.id}. Files are held in this
          prototype session and listed below.
        </p>
      </div>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-5 text-center shadow-sm transition hover:border-blue-400 hover:bg-blue-50">
        <FileUp size={24} className="text-blue-700" />
        <span className="mt-2 text-sm font-black text-slate-900">
          Upload evidence files
        </span>
        <span className="mt-1 text-xs font-semibold text-slate-500">
          PDF, CSV, screenshots, exports, or policy documents
        </span>
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            onUploadEvidence(control.id, event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      <div className="mt-4 space-y-2">
        {evidenceFiles.length === 0 ? (
          <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-500">
            No evidence uploaded yet.
          </p>
        ) : (
          evidenceFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">
                  {file.name}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {formatBytes(file.size)} · {file.uploadedAt}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onRemoveEvidence(control.id, file.id)}
                className="rounded-lg p-2 text-rose-600 transition hover:bg-rose-50"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RiskDetails({ item }) {
  return (
    <>
      <DetailBlock label="Trust Criterion" value={item.trustId} />
      <DetailBlock label="Scenario" value={item.description} />
      <DetailBlock label="Severity" value={item.severity} />
      <DetailBlock label="Likelihood" value={item.likelihood} />
      <DetailBlock
        label="Linked Controls"
        value={item.linkedControls.slice(0, 12).join(", ")}
      />
    </>
  );
}

function TestDetails({ item }) {
  return (
    <>
      <DetailBlock label="Linked Control" value={item.controlId} />
      <DetailBlock label="Evidence Request" value={item.description} />
      <DetailBlock label="Assigned To" value={item.assignedTo} />
      <DetailBlock label="Evidence Type" value={item.evidenceType} />
      <DetailBlock label="Category" value={item.category} />
    </>
  );
}

function PopulationDetails({ item }) {
  return (
    <>
      <DetailBlock label="Description" value={item.description} />
      <DetailBlock label="Source" value={item.source} />
      <DetailBlock label="Period" value={item.period} />
      <DetailBlock label="Linked Controls" value={String(item.count)} />
      <DetailBlock
        label="Sample Control IDs"
        value={item.linkedControls.slice(0, 14).join(", ")}
      />
    </>
  );
}

function DetailBlock({ label, value, preline = false }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold leading-6 text-slate-700 ${
          preline ? "whitespace-pre-line" : ""
        }`}
      >
        {value || "-"}
      </p>
    </div>
  );
}

function CheckedMenuRow({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded border ${
        active ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
      }`}>
        {active ? <span className="h-1.5 w-1.5 rounded-sm bg-white" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

function detailTitle(activeTab, item) {
  if (activeTab === "controls") return `${item.id}: ${item.title}`;
  if (activeTab === "risks") return `${item.id}: ${item.title}`;
  if (activeTab === "tests") return `${item.id}: ${item.title}`;
  return `${item.id}: ${item.name}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function searchableText(row) {
  return Object.values(row)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .join(" ")
    .toLowerCase();
}

function compareRows(a, b, sortBy) {
  const valueFor = (row) => {
    if (sortBy === "title") return row.title || row.name || "";
    if (sortBy === "category") return row.category || "";
    return row.id || row.controlId || "";
  };

  return valueFor(a).localeCompare(valueFor(b), undefined, { numeric: true });
}
