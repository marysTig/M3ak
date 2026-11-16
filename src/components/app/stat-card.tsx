import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  hint,
  icon: IconComponent,
}: {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const Icon = trend === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card-surface p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{label}</p>
        {IconComponent && (
          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <IconComponent className="size-4" />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{value}</span>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend === "up" ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
            )}
          >
            <Icon className="size-3.5" />
            {delta}
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
