import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Search, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nearbyBusinesses } from "@/lib/mock-data";

export const Route = createFileRoute("/customer/discover")({
  head: () => ({
    meta: [
      { title: "Discover Local Businesses — Loyalty Platform" },
      {
        name: "description",
        content: "Find nearby cafés, salons and shops with loyalty programs you can join instantly.",
      },
      { property: "og:title", content: "Discover Local Businesses — Loyalty Platform" },
      {
        property: "og:description",
        content: "Find nearby cafés, salons and shops with loyalty programs you can join instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const [query, setQuery] = useState("");
  const results = nearbyBusinesses.filter((b) =>
    `${b.name} ${b.category}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Discover</h1>
        <p className="text-sm text-muted-foreground">Loyalty programs near you.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search businesses..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Store} title="Nothing nearby" description="Try another search term." />
      ) : (
        <div className="space-y-3">
          {results.map((b) => (
            <div key={b.id} className="card-surface flex items-center gap-4 p-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                {b.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {b.category}
                  <MapPin className="ml-1 size-3" />
                  {b.distance}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{b.perk}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Joined ${b.name}`, { description: "Card added to your wallet" })}
              >
                Join
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
