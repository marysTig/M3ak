import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";

import { LoyaltyCard } from "@/components/app/loyalty-card";
import { Button } from "@/components/ui/button";
import { customerActivity, customerProfile, memberships } from "@/lib/mock-data";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Mes Cartes de Fidélité — Plateforme de Fidélité" },
      {
        name: "description",
        content: "Toutes vos cartes de fidélité locales dans un seul compte, chacune avec son propre solde de points.",
      },
      { property: "og:title", content: "Mes Cartes de Fidélité — Plateforme de Fidélité" },
      {
        property: "og:description",
        content: "Toutes vos cartes de fidélité locales dans un seul compte, chacune avec son propre solde de points.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerHome,
});

function CustomerHome() {
  const total = memberships.reduce((sum, m) => sum + m.points, 0);

  return (
    <>
      <section>
        <h1 className="text-2xl font-semibold">Bonjour {customerProfile.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">
          {memberships.length} cartes de fidélité · {total} points au total
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
        <div className="space-y-3">
          {memberships.map((m) => (
            <LoyaltyCard
              key={m.id}
              business={m.business}
              category={m.category}
              points={m.points}
              nextReward={m.nextReward}
              nextRewardAt={m.nextRewardAt}
              accent={m.color}
              initials={m.initials}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Activité récente</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/customer/profile">Tout voir</Link>
          </Button>
        </div>
        <ul className="card-surface divide-y divide-border">
          {customerActivity.slice(0, 4).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.action}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.business} · {a.time}
                </p>
              </div>
              <span
                className={
                  a.positive
                    ? "shrink-0 text-sm font-medium text-success"
                    : "shrink-0 text-sm font-medium text-muted-foreground"
                }
              >
                {a.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
