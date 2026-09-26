import { createFileRoute } from "@tanstack/react-router";
import { Gift, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MockQr } from "@/components/app/mock-qr";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customerRewards } from "@/lib/mock-data";

export const Route = createFileRoute("/customer/rewards")({
  head: () => ({
    meta: [
      { title: "My Rewards — Loyalty Platform" },
      {
        name: "description",
        content: "See which rewards are ready to redeem and how close you are to the next one.",
      },
      { property: "og:title", content: "My Rewards — Loyalty Platform" },
      {
        property: "og:description",
        content: "See which rewards are ready to redeem and how close you are to the next one.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerRewards,
});

function CustomerRewards() {
  const [tab, setTab] = useState("ready");
  const [redeeming, setRedeeming] = useState<(typeof customerRewards)[number] | null>(null);

  const list = customerRewards.filter((r) => (tab === "ready" ? r.ready : !r.ready));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Rewards</h1>
        <p className="text-sm text-muted-foreground">Each reward belongs to one business.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="ready" className="flex-1">
            Ready
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex-1">
            In progress
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {list.map((r) => (
          <div key={r.id} className="card-surface flex items-center gap-4 p-4">
            <span
              className={
                r.ready
                  ? "flex size-11 items-center justify-center rounded-xl bg-brand-amber-soft text-brand-amber"
                  : "flex size-11 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground"
              }
            >
              {r.ready ? <Gift className="size-5" /> : <Lock className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.business} · {r.points} points
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{r.expires}</p>
            </div>
            {r.ready ? (
              <Button size="sm" onClick={() => setRedeeming(r)}>
                Redeem
              </Button>
            ) : (
              <StatusBadge status="locked" tone="neutral" />
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!redeeming} onOpenChange={(o) => !o && setRedeeming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{redeeming?.name}</DialogTitle>
            <DialogDescription>
              Show this code at {redeeming?.business} to claim your reward.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <MockQr className="max-w-[200px]" label="✓" />
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                toast.success(`${redeeming?.name} redeemed`, {
                  description: `-${redeeming?.points} points at ${redeeming?.business}`,
                });
                setRedeeming(null);
              }}
            >
              Confirm redemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
