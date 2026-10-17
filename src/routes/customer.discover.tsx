import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Search, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveBusinesses } from "@/lib/db/merchants";
import { joinMerchant } from "@/lib/db/cards";

interface BusinessItem {
  id: string;
  name: string;
  category: string | null;
  slug: string | null;
  logo_url: string | null;
}

export const Route = createFileRoute("/customer/discover")({
  head: () => ({
    meta: [
      { title: "Découvrir — Plateforme de Fidélité" },
      { name: "description", content: "Trouvez des commerces locaux avec des programmes de fidélité et rejoignez-les instantanément." },
      { property: "og:title", content: "Découvrir — Plateforme de Fidélité" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    getActiveBusinesses()
      .then((data) => setBusinesses(data as BusinessItem[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const results = businesses.filter((b) =>
    `${b.name} ${b.category ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function handleJoin(b: BusinessItem) {
    if (!b.slug) {
      toast.error("Ce commerce n'a pas encore de programme de fidélité configuré.");
      return;
    }
    setJoining(b.id);
    try {
      const result = await joinMerchant(b.slug);
      if (result.already_member) {
        toast.info(`Vous êtes déjà membre de ${b.name}`);
      } else {
        toast.success(`Vous avez rejoint ${b.name}`, {
          description: "+10 points de bienvenue !",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'adhésion.");
    } finally {
      setJoining(null);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Découvrir</h1>
        <p className="text-sm text-muted-foreground">Programmes de fidélité disponibles.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un commerce..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          Chargement des commerces…
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={Store}
          title={query ? "Aucun résultat" : "Aucun commerce actif"}
          description={query ? "Essayez un autre terme." : "Les commerces apparaîtront ici dès leur validation."}
        />
      ) : (
        <div className="space-y-3">
          {results.map((b) => {
            const initials = b.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <div key={b.id} className="card-surface flex items-center gap-4 p-4">
                {b.logo_url ? (
                  <img src={b.logo_url} alt={b.name} className="size-11 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                    {initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {b.category}
                    {b.category && <MapPin className="ml-1 size-3" />}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    +10 points de bienvenue
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleJoin(b)}
                  disabled={joining === b.id}
                >
                  {joining === b.id ? "…" : "Rejoindre"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
