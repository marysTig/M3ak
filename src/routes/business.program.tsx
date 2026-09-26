import { createFileRoute } from "@tanstack/react-router";
import { Check, Coins, Stamp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoyaltyCard } from "@/components/app/loyalty-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business/program")({
  head: () => ({
    meta: [
      { title: "Loyalty Program — Bloom Café" },
      {
        name: "description",
        content: "Choose a points or stamps program, set earning rules and preview the customer card.",
      },
      { property: "og:title", content: "Loyalty Program — Bloom Café" },
      {
        property: "og:description",
        content: "Choose a points or stamps program, set earning rules and preview the customer card.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProgramPage,
});

const types = [
  {
    id: "points" as const,
    icon: Coins,
    title: "Points",
    copy: "Customers earn points based on their purchases.",
    example: "€1 spent = 1 point",
  },
  {
    id: "stamps" as const,
    icon: Stamp,
    title: "Stamps",
    copy: "Customers collect stamps and receive a reward.",
    example: "10 stamps = Free Coffee",
  },
];

function ProgramPage() {
  const [type, setType] = useState<"points" | "stamps">("points");
  const [name, setName] = useState(business.programName);
  const [rate, setRate] = useState("1");
  const [threshold, setThreshold] = useState("100");
  const [rewardName, setRewardName] = useState("Free Coffee");
  const [active, setActive] = useState(true);

  return (
    <>
      <PageHeader
        title="Loyalty Program"
        subtitle="Set how customers earn and what they unlock."
        actions={
          <Button onClick={() => toast.success("Program saved", { description: `${name} updated.` })}>
            Save Program
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {types.map((t) => {
              const selected = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={cn(
                    "card-surface relative p-5 text-left transition-all",
                    selected
                      ? "border-primary ring-2 ring-primary/20"
                      : "hover:border-border-strong hover:shadow-[var(--shadow-soft)]",
                  )}
                >
                  {selected ? (
                    <span className="absolute right-4 top-4 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <t.icon className="size-5" />
                  </span>
                  <p className="mt-3 font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.copy}</p>
                  <p className="mt-3 rounded-lg bg-surface-muted px-3 py-1.5 text-xs font-medium">
                    {t.example}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="card-surface space-y-5 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Program details</h2>
              <StatusBadge status={active ? "active" : "inactive"} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pname">Program name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rate">
                  {type === "points" ? "Points per €1 spent" : "Stamps per visit"}
                </Label>
                <Input id="rate" value={rate} onChange={(e) => setRate(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {type === "points" ? `1 € = ${rate || 0} point` : `1 visit = ${rate || 0} stamp`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">{type === "points" ? "Points required" : "Stamps required"}</Label>
                <Input
                  id="threshold"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {threshold || 0} {type} = {rewardName || "reward"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reward">Reward</Label>
              <Input
                id="reward"
                value={rewardName}
                onChange={(e) => setRewardName(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-medium">Program status</p>
                <p className="text-xs text-muted-foreground">
                  Customers can join and earn while active.
                </p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Customer card preview</p>
          <LoyaltyCard
            business={business.name}
            category={business.category}
            points={120}
            nextReward={rewardName || "Reward"}
            nextRewardAt={Number(threshold) || 100}
            initials="BC"
          />
          <p className="text-xs text-muted-foreground">
            This is what customers see in their wallet after joining.
          </p>
        </div>
      </div>
    </>
  );
}
