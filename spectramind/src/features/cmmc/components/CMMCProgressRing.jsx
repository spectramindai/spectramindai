import { useEffect, useState } from "react";
import { clampPercentage } from "../utils";

export default function CMMCProgressRing({
  value = 0,
  size = 120,
  stroke = 10,
  progressColor = "#9d6f38",
  trackColor = "#ece7dc",
  textColor = "#25221d",
  duration = 900,
  showLabel = true,
  label,
  className = "",
}) {
  const targetValue = clampPercentage(value);
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    let frameId;
    const startedAt = performance.now();

    const animate = (now) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedValue(targetValue * easedProgress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [duration, targetValue]);

  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || `${Math.round(targetValue)}% complete`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          strokeWidth={stroke}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {showLabel && (
        <span
          className="absolute text-lg font-black"
          style={{ color: textColor }}
        >
          {Math.round(animatedValue)}%
        </span>
      )}
    </div>
  );
}
