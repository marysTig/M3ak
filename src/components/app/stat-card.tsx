import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  hint?: string;
}) {
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card-surface p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="font-display text-3xl font-semibold tracking-tight">{value}</span>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              trend === "up" ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
            )}
          >
            <Icon className="size-3.5" />
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
