const toneClasses = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-blue-50 text-blue-800",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  muted: "bg-white/72 text-slate-500",
};

export default function CMMCStatusBadge({
  children,
  tone = "neutral",
  className = "",
}) {
  return (
    <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${toneClasses[tone] || toneClasses.neutral} ${className}`}>
      {children}
    </span>
  );
}
