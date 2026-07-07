// A single headline figure. `hero` enlarges it for the KPI row.
export function StatTile({
  label,
  value,
  sub,
  hero = false,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
  tone?: "good" | "warning" | "critical";
}) {
  return (
    <div className="card flex flex-col justify-between p-5">
      <span className="eyebrow">{label}</span>
      <div
        className={`tnum mt-3 font-semibold leading-none tracking-tight ${
          hero ? "text-[32px]" : "text-[22px]"
        }`}
        style={tone ? { color: `var(--${tone})` } : { color: "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <span className="mt-2 text-[12px] text-ink-muted">{sub}</span>}
    </div>
  );
}
