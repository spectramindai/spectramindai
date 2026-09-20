import { useState } from "react";
const today = () => new Date().toLocaleDateString("en-CA");
const overdue = record => record.dueDate && record.dueDate < today() && !["Completed", "Closed", "Retired", "Superseded", "Implemented"].includes(record.status);
const box = "rounded-lg border border-slate-200 bg-white p-4";

export default function CMMCOperationWorkbench({ moduleId, records, onEdit, onCreate, canEdit }) {
  if (moduleId === "calendar") return <Calendar records={records} onEdit={onEdit} onCreate={onCreate} canEdit={canEdit} />;
  if (["documents", "procedures"].includes(moduleId)) return <Documents records={records} onEdit={onEdit} onCreate={onCreate} canEdit={canEdit} moduleId={moduleId} />;
  return null;
}

function Stats({ items }) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-3">{items.map(([label, value]) => <div key={label} className={box}><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-[#071a33]">{value}</p></div>)}</div>;
}
function Calendar({ records, onEdit, onCreate, canEdit }) {
  const current = today();
  const [cursor, setCursor] = useState(() => current.slice(0, 7));
  const [view, setView] = useState("month");
  const [selectedDate, setSelectedDate] = useState(current);
  const [status, setStatus] = useState("All");
  const [query, setQuery] = useState("");
  const [year, monthNumber] = cursor.split("-").map(Number);
  const visible = records.filter(record => (status === "All" || record.status === status) && (!query || `${record.title} ${record.owner} ${record.details.activity || ""}`.toLowerCase().includes(query.toLowerCase())));
  const activitiesFor = date => visible.filter(record => record.dueDate === date);
  const move = direction => {
    const amount = view === "year" ? direction * 12 : direction;
    const date = new Date(year, monthNumber - 1 + amount, 1, 12);
    setCursor(formatMonth(date));
  };
  const goToday = () => { setCursor(current.slice(0, 7)); setSelectedDate(current); };
  const selectDate = date => { setSelectedDate(date); if (!date.startsWith(cursor)) setCursor(date.slice(0, 7)); };
  const exportCalendar = () => {
    const escape = value => String(value || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const events = visible.filter(record => record.dueDate).map(record => `BEGIN:VEVENT\nUID:${escape(record.id)}@compvd.ai\nDTSTART;VALUE=DATE:${record.dueDate.replaceAll("-", "")}\nSUMMARY:${escape(record.title)}\nDESCRIPTION:${escape(`${record.status} · Owner: ${record.owner} · ${record.details.recurrence || "One-time"}`)}\nEND:VEVENT`).join("\n");
    const url = URL.createObjectURL(new Blob([`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Compvd.ai//CMMC Compliance Calendar//EN\n${events}\nEND:VCALENDAR\n`], { type: "text/calendar" }));
    const link = document.createElement("a"); link.href = url; link.download = "CMMC-compliance-calendar.ics"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selected = activitiesFor(selectedDate);
  const upcoming = visible.filter(record => record.dueDate && record.dueDate >= current && record.status !== "Completed").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return <>
    <Stats items={[["Upcoming activities", records.filter(r => r.dueDate >= current && r.status !== "Completed").length], ["Overdue", records.filter(overdue).length], ["Completed", records.filter(r => r.status === "Completed").length]]} />
    <section className={box}>
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => move(-1)} aria-label={view === "year" ? "Previous year" : "Previous month"} className="rounded-lg border px-3 py-2 font-bold">←</button>
          <button onClick={goToday} className="rounded-lg border px-3 py-2 text-sm font-bold">Today</button>
          <button onClick={() => move(1)} aria-label={view === "year" ? "Next year" : "Next month"} className="rounded-lg border px-3 py-2 font-bold">→</button>
          <h2 className="ml-2 text-xl font-black text-[#071a33]">{view === "year" ? year : new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
          <select aria-label="Jump to month" value={monthNumber} onChange={event => setCursor(`${year}-${String(event.target.value).padStart(2, "0")}`)} className="rounded-lg border px-2 py-2 text-sm">{Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Date(2020, index, 1).toLocaleDateString(undefined, { month: "long" })}</option>)}</select>
          <select aria-label="Jump to year" value={year} onChange={event => setCursor(`${event.target.value}-${String(monthNumber).padStart(2, "0")}`)} className="rounded-lg border px-2 py-2 text-sm">{Array.from({ length: 11 }, (_, index) => new Date().getFullYear() - 5 + index).map(option => <option key={option}>{option}</option>)}</select>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border p-1">{["month", "year", "agenda"].map(option => <button key={option} onClick={() => setView(option)} className={`rounded-md px-3 py-1.5 text-sm font-bold capitalize ${view === option ? "bg-[#071a33] text-white" : "text-slate-600"}`}>{option}</button>)}</div>
          <button onClick={exportCalendar} disabled={!visible.some(record => record.dueDate)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Export calendar</button>
          {canEdit && <button onClick={() => onCreate({ dueDate: selectedDate })} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">Add activity</button>}
        </div>
      </div>
      <div className="my-4 grid gap-3 sm:grid-cols-[1fr_180px]">
        <input aria-label="Search calendar" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search activity or owner…" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <select aria-label="Filter calendar by status" value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option>All</option><option>Scheduled</option><option>In Progress</option><option>Completed</option></select>
      </div>
      {view === "month" && <MonthGrid year={year} monthNumber={monthNumber} selectedDate={selectedDate} onSelect={selectDate} activitiesFor={activitiesFor} onEdit={onEdit} />}
      {view === "year" && <YearGrid year={year} records={visible} onOpenMonth={monthIndex => { setCursor(`${year}-${String(monthIndex + 1).padStart(2, "0")}`); setView("month"); }} />}
      {view === "agenda" && <Agenda records={visible} onEdit={onEdit} />}
    </section>
    {view === "month" && <div className="mt-4 grid gap-4 lg:grid-cols-2"><section className={box}><div className="mb-3 flex items-center justify-between"><div><h3 className="font-black">{formatDisplayDate(selectedDate)}</h3><p className="text-xs text-slate-500">{selected.length} scheduled item{selected.length === 1 ? "" : "s"}</p></div>{canEdit && <button onClick={() => onCreate({ dueDate: selectedDate })} className="text-sm font-bold text-emerald-700">+ Add on this date</button>}</div><div className="space-y-2">{selected.map(record => <CalendarItem key={record.id} record={record} onEdit={onEdit} />)}{!selected.length && <p className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">No compliance activities scheduled.</p>}</div></section><section className={box}><h3 className="mb-3 font-black">Next activities</h3><div className="space-y-2">{upcoming.slice(0, 6).map(record => <CalendarItem key={record.id} record={record} onEdit={onEdit} showDate />)}{!upcoming.length && <p className="text-sm text-slate-500">No upcoming activities match the filters.</p>}</div></section></div>}
    {records.filter(overdue).length > 0 && <section className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4"><h3 className="mb-2 font-bold text-rose-800">Overdue activities</h3><div className="flex flex-wrap gap-3">{records.filter(overdue).map(record => <button key={record.id} onClick={() => onEdit(record)} className="text-sm font-semibold text-rose-700 underline">{record.title} · {record.dueDate}</button>)}</div></section>}
  </>;
}

const formatMonth = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const formatDate = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatDisplayDate = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const calendarTone = status => status === "Completed" ? "bg-emerald-100 text-emerald-800" : status === "In Progress" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";

function MonthGrid({ year, monthNumber, selectedDate, onSelect, activitiesFor, onEdit }) {
  const first = new Date(year, monthNumber - 1, 1, 12);
  const gridStart = new Date(year, monthNumber - 1, 1 - first.getDay(), 12);
  const dates = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  return <div className="overflow-x-auto"><div className="grid min-w-[760px] grid-cols-7 overflow-hidden rounded-lg border border-slate-200">{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(day => <div key={day} className="border-b bg-slate-50 p-2 text-center text-xs font-bold text-slate-500">{day.slice(0, 3)}</div>)}{dates.map(date => { const value = formatDate(date); const items = activitiesFor(value); const outside = date.getMonth() !== monthNumber - 1; return <div key={value} onClick={() => onSelect(value)} className={`min-h-32 cursor-pointer border-b border-r border-slate-100 p-2 ${outside ? "bg-slate-50/70 text-slate-400" : "bg-white"} ${value === selectedDate ? "ring-2 ring-inset ring-emerald-500" : ""}`}><div className="flex items-center justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${value === today() ? "bg-emerald-600 text-white" : ""}`}>{date.getDate()}</span>{items.length > 3 && <span className="text-[10px] font-bold text-slate-500">+{items.length - 3}</span>}</div><div className="space-y-1">{items.slice(0, 3).map(record => <button key={record.id} onClick={event => { event.stopPropagation(); onEdit(record); }} className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-semibold ${calendarTone(record.status)}`} title={`${record.title} · ${record.owner}`}>{record.title}</button>)}</div></div>; })}</div></div>;
}
function YearGrid({ year, records, onOpenMonth }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 12 }, (_, monthIndex) => { const first = new Date(year, monthIndex, 1, 12); const days = new Date(year, monthIndex + 1, 0, 12).getDate(); const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`; return <button key={monthIndex} onClick={() => onOpenMonth(monthIndex)} className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-emerald-500"><div className="mb-2 flex justify-between"><h3 className="font-black">{first.toLocaleDateString(undefined, { month: "long" })}</h3><span className="text-xs font-bold text-emerald-700">{records.filter(record => record.dueDate?.startsWith(prefix)).length} items</span></div><div className="grid grid-cols-7 gap-1 text-center text-[10px]">{["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`} className="font-bold text-slate-400">{day}</span>)}{Array.from({ length: first.getDay() }, (_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const value = `${prefix}-${String(index + 1).padStart(2, "0")}`; const count = records.filter(record => record.dueDate === value).length; return <span key={value} className={`rounded py-1 ${value === today() ? "bg-emerald-600 text-white" : count ? "bg-emerald-100 font-bold text-emerald-800" : ""}`}>{index + 1}</span>; })}</div></button>; })}</div>;
}
function Agenda({ records, onEdit }) {
  const dated = records.filter(record => record.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const grouped = Object.groupBy ? Object.groupBy(dated, record => record.dueDate.slice(0, 7)) : dated.reduce((groups, record) => ({ ...groups, [record.dueDate.slice(0, 7)]: [...(groups[record.dueDate.slice(0, 7)] || []), record] }), {});
  return <div className="space-y-5">{Object.entries(grouped).map(([month, items]) => <section key={month}><h3 className="mb-2 border-b pb-2 font-black">{new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3><div className="space-y-2">{items.map(record => <CalendarItem key={record.id} record={record} onEdit={onEdit} showDate />)}</div></section>)}{!dated.length && <p className="rounded-lg bg-slate-50 p-8 text-center text-sm text-slate-500">No dated activities match this view.</p>}</div>;
}
function CalendarItem({ record, onEdit, showDate = false }) {
  return <button onClick={() => onEdit(record)} className="flex w-full items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-left hover:border-emerald-500"><div><p className="font-bold text-[#071a33]">{record.title}</p><p className="mt-1 text-xs text-slate-500">{record.owner} · {record.details.recurrence || "One-time"}{showDate ? ` · ${formatDisplayDate(record.dueDate)}` : ""}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${calendarTone(record.status)}`}>{record.status}</span></button>;
}
function Documents({ records, onEdit, onCreate, canEdit, moduleId }) {
  return <><Stats items={[["Approved", records.filter(r => r.status === "Approved").length], ["Awaiting review", records.filter(r => r.status === "In Review").length], ["Review overdue", records.filter(overdue).length]]} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{records.map(r => <article key={r.id} className={box}><div className="mb-3 flex justify-between gap-2 text-xs"><span className="font-bold text-emerald-700">{r.status}</span><span>Version {r.details.documentVersion || "Not assigned"}</span></div><button onClick={() => onEdit(r)} className="text-left text-lg font-black text-[#071a33]">{r.title}</button><p className="mt-2 text-xs text-slate-500">{r.owner} · {r.details.classification || "Internal"}</p><p className="mt-3 line-clamp-3 text-sm text-slate-600">{moduleId === "procedures" ? r.details.purpose || "Define purpose and operating steps." : r.details.changeSummary || "No revision summary recorded."}</p><p className="mt-3 text-xs">Effective: {r.details.effectiveDate || "Not set"} · Review: {r.dueDate || "Not set"}</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => onEdit(r)} className="text-sm font-bold text-emerald-700">Review document</button>{canEdit && ["Approved", "Superseded", "Retired"].includes(r.status) && <button onClick={() => onCreate({ title: r.title, owner: r.owner, controlIds: r.controlIds, relatedIds: [r.id], details: { ...r.details, documentVersion: "", approval: "", effectiveDate: "", changeSummary: "" } })} className="text-sm font-bold text-slate-600">Draft new revision</button>}</div></article>)}</div>{!records.length && <p className={`${box} text-slate-500`}>No documents registered. Add a document with its version and review owner.</p>}</>;
}
