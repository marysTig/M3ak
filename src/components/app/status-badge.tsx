import { cn } from "@/lib/utils";

type Tone = "success" | "neutral" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/20",
  neutral: "bg-muted text-muted-foreground border-border",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-destructive-soft text-destructive border-destructive/20",
  info: "bg-primary-soft text-primary border-primary/20",
};

const map: Record<string, Tone> = {
  active: "success",
  completed: "success",
  earned: "success",
  new: "info",
  pending: "warning",
  adjustment: "warning",
  inactive: "neutral",
  redeemed: "info",
  suspended: "danger",
};

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? map[status.toLowerCase()] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        toneClass[resolved],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}
