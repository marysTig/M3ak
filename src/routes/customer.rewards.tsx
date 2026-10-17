import { createFileRoute } from "@tanstack/react-router";
import { Gift, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/app/status-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getMyCards, redeemReward } from "@/lib/db/cards";
import { getAvailableRewards } from "@/lib/db/rewards";

export const Route = createFileRoute("/customer/rewards")({
  head: () => ({
    meta: [
      { title: "Récompenses — Plateforme de Fidélité" },
      { name: "description", content: "Découvrez les récompenses disponibles et échangez vos points." },
      { property: "og:title", content: "Récompenses — Plateforme de Fidélité" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerRewards,
});

interface RewardItem {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  ready: boolean;
  missing: number;
  merchantName: string;
  cardId: string;
  currentPoints: number;
  merchantId: string;
}

function CustomerRewards() {
  const [tab, setTab] = useState("ready");
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [redeeming, setRedeeming] = useState<RewardItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadRewards() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Charger toutes les cartes du client
    const cards = await getMyCards();
    const all: RewardItem[] = [];

    for (const card of cards) {
      const merchant = Array.isArray(card.merchants) ? card.merchants[0] : card.merchants;
      if (!merchant) continue;
      const merchantRewards = await getAvailableRewards(merchant.id, card.points);
      for (const r of merchantRewards) {
        all.push({
          id: r.id,
          name: r.name,
          description: r.description,
          points_cost: r.points_cost,
          ready: r.ready,
          missing: r.missing,
          merchantName: merchant.name,
          cardId: card.id,
          currentPoints: card.points,
          merchantId: merchant.id,
        });
      }
    }

    setRewards(all);
    setLoading(false);
  }

  useEffect(() => {
    loadRewards();
  }, []);

  const list = rewards.filter((r) => (tab === "ready" ? r.ready : !r.ready));

  async function handleRedeem() {
    if (!redeeming) return;
    setSaving(true);
    try {
      const result = await redeemReward(redeeming.cardId, redeeming.id);
      toast.success(`${redeeming.name} échangé !`, {
        description: `-${result.points_spent} points — nouveau solde : ${result.new_balance} pts`,
      });
      setRedeeming(null);
      await loadRewards();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'échange.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Récompenses</h1>
        <p className="text-sm text-muted-foreground">Chaque récompense appartient à un commerce.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="ready" className="flex-1">
            Disponibles ({rewards.filter((r) => r.ready).length})
          </TabsTrigger>
          <TabsTrigger value="progress" className="flex-1">
            En cours ({rewards.filter((r) => !r.ready).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
          <Gift className="size-10 text-muted-foreground" />
          <p className="font-medium">
            {tab === "ready" ? "Aucune récompense disponible" : "Vous n'avez pas de récompenses en cours"}
          </p>
          <p className="text-sm text-muted-foreground">
            {tab === "ready" ? "Gagnez des points en visitant vos commerces favoris." : "Les récompenses apparaîtront ici dès que vous rejoignez un commerce."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={`${r.cardId}-${r.id}`} className="card-surface flex items-center gap-4 p-4">
              <span className={
                r.ready
                  ? "flex size-11 items-center justify-center rounded-xl bg-brand-amber-soft text-brand-amber"
                  : "flex size-11 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground"
              }>
                {r.ready ? <Gift className="size-5" /> : <Lock className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.merchantName} · {r.points_cost} points
                </p>
                {!r.ready && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Encore {r.missing} pts
                  </p>
                )}
              </div>
              {r.ready ? (
                <Button size="sm" onClick={() => setRedeeming(r)}>
                  Échanger
                </Button>
              ) : (
                <StatusBadge status="locked" tone="neutral" />
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!redeeming} onOpenChange={(o) => !o && setRedeeming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{redeeming?.name}</DialogTitle>
            <DialogDescription>
              Montrez ce code à {redeeming?.merchantName} pour obtenir votre récompense.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-surface-muted p-4 text-center">
            <p className="font-display text-4xl font-bold text-primary">✓</p>
            <p className="mt-2 text-sm font-medium">{redeeming?.name}</p>
            <p className="text-xs text-muted-foreground">
              Coûte {redeeming?.points_cost} pts — Solde actuel : {redeeming?.currentPoints} pts
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={handleRedeem}
              disabled={saving}
            >
              {saving ? "Échange en cours…" : "Confirmer l'échange"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
