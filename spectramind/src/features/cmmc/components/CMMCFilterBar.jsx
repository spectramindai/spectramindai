import { Search, SlidersHorizontal } from "lucide-react";

export default function CMMCFilterBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search CMMC workspace",
  filters = [],
  actions,
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/75 bg-white/62 p-4 shadow-xl shadow-slate-900/5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{searchPlaceholder}</span>
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-600"
          />
        </label>

        {filters.map((filter) => {
          const selectedOption = filter.options.find((option) => option.value === filter.value) || filter.options[0];

          return (
            <details key={filter.id} className="relative min-w-40">
              <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-600">
                <SlidersHorizontal size={16} className="text-slate-400" />
                <span className="truncate">{selectedOption?.label || filter.label}</span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                {filter.options.map((option) => {
                  const active = option.value === filter.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => filter.onChange?.(option.value)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-bold transition ${
                        active ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${
                        active ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                      }`}>
                        {active ? <span className="h-1.5 w-1.5 rounded-sm bg-white" /> : null}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
