import { createFileRoute } from "@tanstack/react-router";
import { Cake, Coffee, Croissant, Gift, Pencil, Plus, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { getMerchantRewards, createReward, updateReward, type Reward } from "@/lib/db/rewards";

export const Route = createFileRoute("/business/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — M3ak Loyalty" },
      { name: "description", content: "Create and manage the rewards customers unlock with their points." },
      { property: "og:title", content: "Rewards — M3ak Loyalty" },
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
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [items, setItems] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id").eq("owner_id", user.id).single();
      if (m) {
        setMerchantId(m.id);
        const rewards = await getMerchantRewards(m.id);
        setItems(rewards);
      }
      setLoading(false);
    });
  }, []);

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
      points: String(reward.points_cost),
      active: reward.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name) { toast.error("Give the reward a name."); return; }
    if (!merchantId) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateReward(editing.id, {
          name: form.name,
          description: form.description,
          points_cost: Number(form.points) || 0,
          active: form.active,
        });
        setItems(items.map((r) => r.id === editing.id ? { ...r, ...updated } : r));
        toast.success(`${form.name} updated`);
      } else {
        const created = await createReward(merchantId, {
          name: form.name,
          description: form.description,
          points_cost: Number(form.points) || 0,
          active: form.active,
          icon: "gift",
        });
        setItems([...items, created]);
        toast.success(`${form.name} created`);
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Chargement des récompenses…
      </div>
    );
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

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <Gift className="size-10 text-muted-foreground" />
          <p className="font-medium">Aucune récompense créée</p>
          <p className="text-sm text-muted-foreground">Créez votre première récompense pour que vos clients puissent l'échanger.</p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="size-4" /> Créer une récompense
          </Button>
        </div>
      ) : (
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
                      {r.points_cost} <span className="text-sm font-normal text-muted-foreground">points</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{r.redeemed_count ?? 0} redeemed</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                    <Pencil className="size-4" /> Edit
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit reward" : "Create reward"}</DialogTitle>
            <DialogDescription>Customers redeem rewards once they reach the required points.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rname">Reward name</Label>
              <Input id="rname" placeholder="Free Coffee" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rdesc">Description</Label>
              <Textarea id="rdesc" placeholder="Any hot coffee of your choice." value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rpoints">Points required</Label>
              <Input id="rpoints" inputMode="numeric" placeholder="100" value={form.points}
                onChange={(e) => setForm({ ...form, points: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-muted px-4 py-3">
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-xs text-muted-foreground">Active rewards are visible to customers.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Sauvegarde…" : editing ? "Save changes" : "Create Reward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
