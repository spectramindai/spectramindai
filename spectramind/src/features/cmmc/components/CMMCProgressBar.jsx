import { clampPercentage } from "../utils";

export default function CMMCProgressBar({
  value = 0,
  label,
  showValue = true,
  color = "#9d6f38",
  trackColor = "#ece7dc",
  className = "",
}) {
  const percentage = clampPercentage(value);

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black text-slate-700">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(percentage)}%</span>}
        </div>
      )}

      <div
        className="h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: trackColor }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
