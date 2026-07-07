// Consistent zone header: a numbered eyebrow + title, with optional trailing slot.
export function ZoneHeader({
  index,
  title,
  trailing,
}: {
  index: number;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-[var(--neutral-wash)] px-1 text-[12px] font-semibold text-ink-secondary tnum">
          {index}
        </span>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-secondary">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}
