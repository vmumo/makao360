export function CycleProgress({
  value, target, size = 84, light,
}: { value: number; target: number; size?: number; light?: boolean }) {
  const pct = target <= 0 ? 0 : Math.min(100, Math.round((value / target) * 100));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const trackColor = light ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.20)";
  const fillColor = light ? "var(--primary)" : "var(--accent)";
  const textColor = light ? "var(--foreground)" : "currentColor";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={fillColor} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display font-bold"
           style={{ color: textColor }}>
        {pct}%
      </div>
    </div>
  );
}
