// A labelled read-only data point used across the client-data zone.
export function DataField({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      <span
        className={`text-[14px] font-medium text-ink ${mono ? "tnum" : ""}`}
      >
        {children}
      </span>
    </div>
  );
}
