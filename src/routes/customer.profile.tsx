import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, LogOut, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { getMyCards } from "@/lib/db/cards";
import { getMyTransactions } from "@/lib/db/transactions";
import type { Transaction } from "@/lib/db/transactions";

export const Route = createFileRoute("/customer/profile")({
  head: () => ({
    meta: [
      { title: "Mon Profil — Plateforme de Fidélité" },
      { name: "description", content: "Votre compte fidélité unique : adhésions, historique d'activité et notifications." },
      { property: "og:title", content: "Mon Profil — Plateforme de Fidélité" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<{ id: string; full_name: string; initials: string } | null>(null);
  const [email, setEmail] = useState("");
  const [cards, setCards] = useState<{ points: number }[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Notifications
  const [push, setPush] = useState(true);
  const [offers, setOffers] = useState(false);

  // Dialog compte
  const [editOpen, setEditOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setEmail(user.email ?? "");

      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      if (prof) {
        const parts = prof.full_name.trim().split(" ");
        const initials = parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();
        setProfile({ id: prof.id, full_name: prof.full_name, initials });
        setNameInput(prof.full_name);
      }

      const [cardsData, txData] = await Promise.all([
        getMyCards(),
        getMyTransactions(20),
      ]);
      setCards(cardsData as { points: number }[]);
      setActivity(txData);
      setLoading(false);
    });
  }, []);

  const totalPoints = cards.reduce((s, c) => s + c.points, 0);

  async function handleSaveName() {
    if (!profile || !nameInput.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: nameInput.trim() })
        .eq("id", profile.id);
      if (error) throw error;
      const parts = nameInput.trim().split(" ");
      const initials = parts.map((p) => p[0]).join("").slice(0, 2).toUpperCase();
      setProfile({ ...profile, full_name: nameInput.trim(), initials });
      setEditOpen(false);
      toast.success("Nom mis à jour !");
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      {/* Header profil */}
      <div className="card-surface flex items-center gap-4 p-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
          {profile?.initials ?? "?"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{profile?.full_name ?? "—"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          [String(cards.length), "Cartes"],
          [String(totalPoints), "Points"],
          [String(activity.filter((a) => a.tx_type === "redeemed").length), "Récompenses"],
        ].map(([value, label]) => (
          <div key={label} className="card-surface p-4 text-center">
            <p className="font-display text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Historique */}
      {activity.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Historique d'activité</h2>
          <ul className="card-surface divide-y divide-border">
            {activity.map((a) => {
              const merchant = Array.isArray(a.merchants) ? (a.merchants as { name: string }[])[0] : a.merchants as { name: string } | null;
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.description}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {merchant?.name ?? ""} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <span className={a.points_delta > 0 ? "shrink-0 text-sm font-medium text-success" : "shrink-0 text-sm font-medium text-muted-foreground"}>
                    {a.points_delta > 0 ? "+" : ""}{a.points_delta} pts
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="font-semibold">Notifications</h2>
        <div className="card-surface divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Alertes récompenses</p>
              <p className="text-xs text-muted-foreground">Quand une récompense devient disponible.</p>
            </div>
            <Switch checked={push} onCheckedChange={setPush} />
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Offres locales</p>
              <p className="text-xs text-muted-foreground">Nouveaux commerces à proximité.</p>
            </div>
            <Switch checked={offers} onCheckedChange={setOffers} />
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="space-y-2">
        <Link
          to="/customer/discover"
          className="card-surface flex items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Découvrir des commerces
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <button
          onClick={() => setEditOpen(true)}
          className="card-surface flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
        >
          Modifier mon nom
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </section>

      <Button variant="outline" className="w-full" onClick={handleSignOut}>
        <LogOut className="size-4" /> Se déconnecter
      </Button>

      {/* Dialog modifier le nom */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier mon nom</DialogTitle>
            <DialogDescription>Ce nom sera affiché sur vos cartes de fidélité.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nom complet</Label>
            <Input
              id="profile-name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Votre nom"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveName} disabled={saving}>
              <Save className="size-4" />
              {saving ? "Sauvegarde…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
