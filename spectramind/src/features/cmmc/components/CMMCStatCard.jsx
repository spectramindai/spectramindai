const toneClasses = {
  neutral: "border-slate-200 bg-[#fffdf8]/72 text-slate-900",
  blue: "border-blue-600/20 bg-blue-50 text-blue-800",
  success: "border-emerald-500/20 bg-emerald-50 text-emerald-800",
  warning: "border-amber-500/20 bg-amber-50 text-amber-800",
  danger: "border-rose-500/20 bg-rose-50 text-rose-800",
};

export default function CMMCStatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}) {
  const colorClass = toneClasses[tone] || toneClasses.neutral;

  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium opacity-75">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">
            {value}
          </p>
        </div>

        {Icon && (
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/62">
            <Icon size={20} />
          </div>
        )}
      </div>

      {helper && (
        <p className="mt-3 text-sm font-semibold opacity-75">
          {helper}
        </p>
      )}
    </div>
  );
}
