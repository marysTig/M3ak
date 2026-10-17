import { createFileRoute } from "@tanstack/react-router";
import { Mail, Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NewCardDialog } from "@/components/app/new-card-dialog";
import { PageHeader } from "@/components/app/page-header";
import { QrDisplay } from "@/components/app/qr-display";
import { VirtualCard, themes } from "@/routes/business.program";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getMerchantCustomers, type CustomerWithCard } from "@/lib/db/customers";
import { addPoints } from "@/lib/db/cards";
import { getCardTransactions } from "@/lib/db/transactions";
import type { Transaction } from "@/lib/db/transactions";
import { getLoyaltyProgram } from "@/lib/db/program";

export const Route = createFileRoute("/business/customers")({
  head: () => ({
    meta: [
      { title: "Clients — M3ak Loyalty" },
      { name: "description", content: "Gérez vos clients fidélité, leurs soldes et leur historique." },
      { property: "og:title", content: "Clients — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

const filters = ["all", "active", "inactive", "new"] as const;

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function CustomersPage() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [themeId, setThemeId] = useState("aurora");
  const [customers, setCustomers] = useState<CustomerWithCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<CustomerWithCard | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [cardTx, setCardTx] = useState<Transaction[]>([]);

  const reload = useCallback(async (mId: string) => {
    const data = await getMerchantCustomers(mId);
    setCustomers(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id, name").eq("owner_id", user.id).single();
      if (m) {
        setMerchantId(m.id);
        setMerchantName(m.name);
        const prog = await getLoyaltyProgram(m.id);
        if (prog?.theme_id) setThemeId(prog.theme_id);
        await reload(m.id);
      }
      setLoading(false);
    });
  }, [reload]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchFilter = filter === "all" || c.status === filter;
      const matchQuery = !q || c.customer.full_name.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [customers, query, filter]);

  async function openSheet(c: CustomerWithCard) {
    setSelected(c);
    setPointsInput("");
    setPointsError("");
    // Charger les dernières transactions de la carte
    try {
      const tx = await getCardTransactions(c.card.id);
      setCardTx(tx.slice(0, 10));
    } catch {
      setCardTx([]);
    }
  }

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !merchantId) return;
    const n = Number(pointsInput);
    if (!n || n <= 0 || n > 10000) {
      setPointsError("Nombre de points invalide (1–10 000).");
      return;
    }
    setAddingPoints(true);
    try {
      const result = await addPoints({
        qrToken: selected.card.qr_token,
        points: n,
        description: `Ajout manuel — ${merchantName}`,
      });
      toast.success(`+${n} points ajoutés à ${selected.customer.full_name}`, {
        description: `Nouveau solde : ${result.new_balance} points`,
      });
      setPointsInput("");
      setPointsError("");
      if (merchantId) await reload(merchantId);
      // Rafraîchir la sélection
      setSelected((prev) => prev ? { ...prev, card: { ...prev.card, points: result.new_balance } } : null);
      const tx = await getCardTransactions(selected.card.id);
      setCardTx(tx.slice(0, 10));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ajout.");
    } finally {
      setAddingPoints(false);
    }
  }

  const selectedTheme = themes.find((t) => t.id === themeId) ?? themes[0]!;

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${customers.length} client${customers.length !== 1 ? "s" : ""} au total`}
        actions={
          <Button onClick={() => setNewCardOpen(true)}>
            <Plus className="size-4" /> Nouveau client
          </Button>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher un client…" className="pl-9" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Users} title="Aucun client trouvé"
              description={customers.length === 0
                ? "Créez votre premier client avec le bouton ci-dessus."
                : "Essayez un autre filtre ou terme de recherche."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Total gagné</TableHead>
                  <TableHead className="hidden md:table-cell">Inscrit</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.card.id} className="cursor-pointer hover:bg-accent"
                    onClick={() => openSheet(c)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {initials(c.customer.full_name)}
                        </span>
                        <p className="font-medium">{c.customer.full_name}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{c.card.points}</TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                      {c.card.total_earned}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.joinedFormatted}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Fiche client */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.customer.full_name}</SheetTitle>
                <SheetDescription>
                  Inscrit le {selected.joinedFormatted}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Carte virtuelle */}
                <VirtualCard
                  theme={selectedTheme}
                  businessName={merchantName}
                  points={selected.card.points}
                  compact
                />

                {/* QR + solde */}
                <div className="rounded-xl bg-surface-muted p-4 text-center">
                  <QrDisplay token={selected.card.qr_token} size={100} />
                  <p className="mt-2 font-display text-2xl font-bold text-primary">
                    {selected.card.points} pts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total gagné : {selected.card.total_earned} pts
                  </p>
                </div>

                {/* Ajout de points */}
                <form onSubmit={handleAddPoints} className="space-y-3">
                  <Label htmlFor="pts">Ajouter des points</Label>
                  <div className="flex gap-2">
                    <Input
                      id="pts" inputMode="numeric" placeholder="ex: 20"
                      value={pointsInput}
                      onChange={(e) => { setPointsInput(e.target.value); setPointsError(""); }}
                    />
                    <Button type="submit" disabled={addingPoints || !pointsInput}>
                      {addingPoints ? "…" : "+"}
                    </Button>
                  </div>
                  {pointsError && <p className="text-xs text-destructive">{pointsError}</p>}
                </form>

                {/* Historique transactions */}
                {cardTx.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Dernières transactions</p>
                    <ul className="space-y-1">
                      {cardTx.map((t) => (
                        <li key={t.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-xs">
                          <span className="text-muted-foreground">{t.description}</span>
                          <span className={t.points_delta > 0 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                            {t.points_delta > 0 ? "+" : ""}{t.points_delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={async () => {
          if (merchantId) await reload(merchantId);
        }}
      />
    </>
  );
}
