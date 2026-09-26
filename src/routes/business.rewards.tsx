import { createFileRoute } from "@tanstack/react-router";
import { Cake, Coffee, Croissant, Gift, Pencil, Plus, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { rewards as seed, type Reward } from "@/lib/mock-data";

export const Route = createFileRoute("/business/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Create and manage the rewards customers unlock with their points.",
      },
      { property: "og:title", content: "Rewards — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Create and manage the rewards customers unlock with their points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RewardsPage,
});

const icons: Record<string, LucideIcon> = {
  coffee: Coffee,
  croissant: Croissant,
  ticket: Ticket,
  cake: Cake,
  gift: Gift,
};

const emptyForm = { name: "", description: "", points: "", active: true };

function RewardsPage() {
  const [items, setItems] = useState<Reward[]>(seed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(reward: Reward) {
    setEditing(reward);
    setForm({
      name: reward.name,
      description: reward.description,
      points: String(reward.points),
      active: reward.active,
    });
    setOpen(true);
  }

  function save() {
    if (!form.name) {
      toast.error("Give the reward a name.");
      return;
    }
    if (editing) {
      setItems(
        items.map((r) =>
          r.id === editing.id
            ? { ...r, name: form.name, description: form.description, points: Number(form.points) || 0, active: form.active }
            : r,
        ),
      );
      toast.success(`${form.name} updated`);
    } else {
      setItems([
        ...items,
        {
          id: `r${Date.now()}`,
          name: form.name,
          description: form.description,
          icon: "gift",
          points: Number(form.points) || 0,
          active: form.active,
          redeemed: 0,
        },
      ]);
      toast.success(`${form.name} created`);
    }
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Rewards"
        subtitle="What customers can unlock with their points."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Create Reward
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => {
          const Icon = icons[r.icon] ?? Gift;
          return (
            <div key={r.id} className="card-surface flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-amber-soft text-brand-amber">
                  <Icon className="size-5" />
                </span>
                <StatusBadge status={r.active ? "active" : "inactive"} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-sm text-muted-foreground">{r.description}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="font-display text-lg font-semibold">
                    {r.points} <span className="text-sm font-normal text-muted-foreground">points</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.redeemed} redeemed</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reward" : "Create reward"}</DialogTitle>
            <DialogDescription>
              Customers redeem rewards once they reach the required points.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rname">Reward name</Label>
              <Input
                id="rname"
                placeholder="Free Coffee"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdesc">Description</Label>
              <Textarea
                id="rdesc"
                placeholder="Any hot coffee of your choice."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rpoints">Points required</Label>
              <Input
                id="rpoints"
                inputMode="numeric"
                placeholder="100"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-xs text-muted-foreground">Active rewards are visible to customers.</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create Reward"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
