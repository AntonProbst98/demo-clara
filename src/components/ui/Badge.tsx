import type { StatusTone } from "@/lib/account";

export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="badge" data-tone={tone}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
