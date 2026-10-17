import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { LoyaltyCard } from "@/components/app/loyalty-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getMyCards } from "@/lib/db/cards";
import { getMyTransactions } from "@/lib/db/transactions";
import type { Transaction } from "@/lib/db/transactions";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Mes Cartes de Fidélité — Plateforme de Fidélité" },
      { name: "description", content: "Toutes vos cartes de fidélité locales dans un seul compte, chacune avec son propre solde de points." },
      { property: "og:title", content: "Mes Cartes de Fidélité — Plateforme de Fidélité" },
      { property: "og:description", content: "Toutes vos cartes de fidélité locales dans un seul compte, chacune avec son propre solde de points." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerHome,
});

interface CardData {
  id: string;
  points: number;
  merchants: { id: string; name: string; category: string | null; logo_url: string | null } | null;
}

function CustomerHome() {
  const [firstName, setFirstName] = useState("");
  const [cards, setCards] = useState<CardData[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // Charger le prénom depuis le profil
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (profile?.full_name) {
        setFirstName(profile.full_name.split(" ")[0]);
      }

      try {
        const [cardsData, txData] = await Promise.all([
          getMyCards(),
          getMyTransactions(10),
        ]);
        setCards(cardsData as CardData[]);
        setActivity(txData);
      } catch (err) {
        console.error("Erreur de chargement:", err);
      }
      setLoading(false);
    });
  }, []);

  const total = cards.reduce((sum, c) => sum + c.points, 0);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <section>
        <h1 className="text-2xl font-semibold">
          Bonjour {firstName || "👋"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {cards.length} carte{cards.length !== 1 ? "s" : ""} de fidélité · {total} points au total
        </p>
      </section>

      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Un compte, tous les commerces</p>
        <p className="mt-1 font-display text-3xl font-semibold">{total} points</p>
        <p className="mt-1 text-xs opacity-80">
          Les points restent chez le commerce qui les a émis.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-4">
          <Link to="/customer/scan">
            <Plus className="size-4" /> Rejoindre un commerce
          </Link>
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Mes cartes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/customer/discover">
              Découvrir <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Aucune carte pour l'instant.</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/customer/scan">Rejoindre un commerce</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => {
              const merchant = Array.isArray(c.merchants) ? c.merchants[0] : c.merchants;
              const name = merchant?.name ?? "Commerce";
              const category = merchant?.category ?? "";
              const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
              return (
                <LoyaltyCard
                  key={c.id}
                  business={name}
                  category={category}
                  points={c.points}
                  nextReward=""
                  nextRewardAt={100}
                  accent="var(--color-chart-1)"
                  initials={initials}
                />
              );
            })}
          </div>
        )}
      </section>

      {activity.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Activité récente</h2>
            <Button asChild variant="ghost" size="sm">
              <Link to="/customer/profile">Tout voir</Link>
            </Button>
          </div>
          <ul className="card-surface divide-y divide-border">
            {activity.slice(0, 4).map((a) => {
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
    </>
  );
}
