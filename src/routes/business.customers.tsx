import { createFileRoute } from "@tanstack/react-router";
import { Mail, Minus, Plus, Search, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resendLoyaltyCardEmail } from "@/lib/email-service";
import {
  addPoints,
  formatDate,
  formatDateShort,
  getCardByCustomer,
  getCustomerById,
  getCustomersWithCards,
  getTransactionsByCard,
  MERCHANT_ID,
  MERCHANT_NAME,
  STORE_ID,
  validatePointsToAdd,
  type CustomerWithCard,
  type LoyaltyTransaction,
} from "@/lib/loyalty-store";

export const Route = createFileRoute("/business/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Search, filter and manage loyalty customers, points balances and visit history.",
      },
      { property: "og:title", content: "Customers — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Search, filter and manage loyalty customers, points balances and visit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

const filters = ["all", "active", "inactive", "new"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<CustomerWithCard | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Rafraîchissement forcé
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Données réelles depuis le store
  const allCustomers = useMemo(
    () => getCustomersWithCards(MERCHANT_ID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const rows = useMemo(
    () =>
      allCustomers.filter((c) => {
        const matchesFilter = filter === "all" || c.status === filter;
        const q = query.trim().toLowerCase();
        const matchesQuery =
          !q ||
          c.customer.name.toLowerCase().includes(q) ||
          c.customer.email.toLowerCase().includes(q);
        return matchesFilter && matchesQuery;
      }),
    [allCustomers, query, filter],
  );

  // Transactions du client sélectionné
  const history: LoyaltyTransaction[] = useMemo(() => {
    if (!selected?.card?.id) return [];
    return getTransactionsByCard(selected.card.id);
  }, [selected, refreshKey]);

  // Rafraîchir selected depuis le store après modification
  function refreshSelected(customerId: string) {
    const customer = getCustomerById(customerId);
    if (!customer) return;
    const card = getCardByCustomer(customerId, MERCHANT_ID);
    if (!card) return;
    const status = allCustomers.find((c) => c.customer.id === customerId)?.status ?? "active";
    setSelected({
      customer,
      card,
      status,
      joinedFormatted: formatDateShort(customer.createdAt),
    });
  }

  function handlePointsInputChange(value: string) {
    setPointsInput(value);
    if (!value) {
      setPointsError("");
      return;
    }
    const v = validatePointsToAdd(Number(value));
    setPointsError(v.error ?? "");
  }

  async function handleAddPoints() {
    if (!selected?.card?.id) return;
    const n = Number(pointsInput);
    const v = validatePointsToAdd(n);
    if (!v.valid) {
      setPointsError(v.error ?? "Valeur invalide.");
      return;
    }

    setAddingPoints(true);
    try {
      addPoints(
        selected.card.id,
        n,
        MERCHANT_ID,
        STORE_ID,
        `Ajout manuel — ${MERCHANT_NAME}`,
        MERCHANT_ID,
      );
      toast.success(`+${n} points ajoutés à ${selected.customer.name}`);
      setPointsInput("");
      setPointsError("");
      refresh();
      refreshSelected(selected.customer.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue.";
      toast.error(msg);
    } finally {
      setAddingPoints(false);
    }
  }

  async function handleResendEmail() {
    if (!selected) return;
    setResendLoading(true);
    try {
      const result = await resendLoyaltyCardEmail({
        customer: selected.customer,
        card: selected.card,
        businessName: MERCHANT_NAME,
      });
      if (result.success) {
        if (result.simulated) {
          toast.info("Email simulé (EmailJS non configuré).");
        } else {
          toast.success(`Email renvoyé à ${selected.customer.email}`);
        }
      } else {
        toast.error("Échec du renvoi. Vérifiez la configuration EmailJS.");
      }
    } catch {
      toast.error("Erreur lors du renvoi de l'email.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone enrolled in your loyalty program."
        actions={
          <Button id="btn-new-card-customers" onClick={() => setNewCardOpen(true)}>
            <Plus className="size-4" />
            Nouvelle carte
          </Button>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="No customers found"
              description={
                allCustomers.length === 0
                  ? "Aucun client encore. Créez votre première carte."
                  : "Try a different search term or filter."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom (Client)</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow
                    key={c.customer.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {initials(c.customer.name)}
                        </span>
                        <span className="font-medium">{c.customer.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.customer.email}
                    </TableCell>
                    <TableCell className="text-right font-medium">{c.card.points}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(c);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Sheet détail client — design existant conservé */}
      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setPointsInput("");
            setPointsError("");
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.customer.name}</SheetTitle>
                <SheetDescription>{selected.customer.email}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-8">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{selected.card.points}</p>
                    <p className="text-xs text-muted-foreground">Current points</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{selected.card.totalEarned}</p>
                    <p className="text-xs text-muted-foreground">Total earned</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{history.length}</p>
                    <p className="text-xs text-muted-foreground">Transactions</p>
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  {[
                    ["Inscrit le", selected.joinedFormatted],
                    ["Statut carte", selected.card.status],
                    ["Dernière mise à jour", formatDateShort(selected.card.updatedAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium capitalize">{v}</dd>
                    </div>
                  ))}
                </dl>

                {/* Virtual Card & QR Code */}
                {selected.card.qrToken && (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-xs font-medium text-muted-foreground">Carte de fidélité</p>
                    <div className="w-full max-w-[360px]">
                      <VirtualCard
                        theme={themes.find(t => t.id === selected.card.themeId) || themes[0]}
                        businessName={MERCHANT_NAME}
                        points={selected.card.points}
                        compact
                      />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">QR Code</p>
                      <QrDisplay token={selected.card.qrToken} size={160} />
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {selected.card.qrToken.slice(0, 16)}...
                      </p>
                    </div>
                  </div>
                )}

                {/* Ajout de points */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Ajouter des points</p>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="sheet-points" className="sr-only">
                        Points à ajouter
                      </Label>
                      <Input
                        id="sheet-points"
                        inputMode="numeric"
                        placeholder="ex: 20"
                        value={pointsInput}
                        onChange={(e) => handlePointsInputChange(e.target.value)}
                        disabled={addingPoints}
                      />
                      {pointsError && (
                        <p className="text-xs text-destructive">{pointsError}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddPoints}
                      disabled={addingPoints || !pointsInput || !!pointsError}
                    >
                      <Plus className="size-4" /> Ajouter
                    </Button>
                  </div>
                </div>

                {/* Actions secondaires */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleResendEmail}
                    disabled={resendLoading}
                  >
                    <Mail className="size-4" />
                    {resendLoading ? "Envoi..." : "Renvoyer carte"}
                  </Button>
                </div>

                {/* Historique transactions */}
                <div>
                  <p className="mb-2 text-sm font-medium">Transaction history</p>
                  {history.length === 0 ? (
                    <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-muted-foreground">
                      No transactions yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{t.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                          </div>
                          <span
                            className={
                              t.pointsAdded >= 0
                                ? "font-medium text-success"
                                : "font-medium text-destructive"
                            }
                          >
                            {t.pointsAdded > 0 ? `+${t.pointsAdded}` : t.pointsAdded}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Dialog nouvelle carte */}
      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={refresh}
      />
    </>
  );
}
