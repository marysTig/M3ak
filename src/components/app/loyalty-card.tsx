import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function LoyaltyCard({
  business,
  category,
  points,
  nextReward,
  nextRewardAt,
  accent = "var(--color-primary)",
  initials,
  className,
}: {
  business: string;
  category?: string;
  points: number;
  nextReward: string;
  nextRewardAt: number;
  accent?: string;
  initials: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((points / Math.max(nextRewardAt, 1)) * 100));
  const remaining = Math.max(0, nextRewardAt - points);

  return (
    <div className={cn("card-surface overflow-hidden", className)}>
      <div className="h-1.5 w-full" style={{ background: accent }} />
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex size-10 items-center justify-center rounded-xl text-sm font-semibold text-white"
            style={{ background: accent }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{business}</p>
            {category ? <p className="text-xs text-muted-foreground">{category}</p> : null}
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold leading-none">{points}</p>
            <p className="text-xs text-muted-foreground">points</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Next: {nextReward}</span>
            <span className="font-medium">
              {remaining === 0 ? "Ready to redeem" : `${remaining} points to go`}
            </span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      </div>
    </div>
  );
}
