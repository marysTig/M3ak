import { createFileRoute } from "@tanstack/react-router";
import { Plus, Receipt, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NewCardDialog } from "@/components/app/new-card-dialog";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addPoints,
  formatDate,
  getCardByCustomer,
  getCustomers,
  getTransactionsByMerchant,
  MERCHANT_ID,
  MERCHANT_NAME,
  STORE_ID,
  validatePointsToAdd,
  type LoyaltyTransaction,
} from "@/lib/loyalty-store";

export const Route = createFileRoute("/business/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Log points earned, redeemed and adjusted for your loyalty customers.",
      },
      { property: "og:title", content: "Transactions — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Log points earned, redeemed and adjusted for your loyalty customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const filters = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
] as const;

function TransactionsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [form, setForm] = useState({ customerId: "", points: "", reason: "" });
  const [formError, setFormError] = useState({ points: "" });

  // Rafraîchissement
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Données réelles
  const realTransactions: LoyaltyTransaction[] = useMemo(
    () => getTransactionsByMerchant(MERCHANT_ID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const realCustomers = useMemo(
    () => getCustomers(MERCHANT_ID),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const visible = useMemo(() => {
    let list = realTransactions;
    if (filter !== "all") {
      list = list.filter((t) => t.pointsAdded > 0);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const customer = realCustomers.find((c) => c.id === t.customerId);
        return customer?.name.toLowerCase().includes(q) ?? false;
      });
    }
    return list;
  }, [realTransactions, realCustomers, filter, query]);

  function getCustomerName(customerId: string): string {
    return realCustomers.find((c) => c.id === customerId)?.name ?? "Client inconnu";
  }

  function validateForm() {
    const errs = { points: "" };
    const v = validatePointsToAdd(Number(form.points));
    if (!v.valid) errs.points = v.error ?? "Valeur invalide.";
    setFormError(errs);
    return !errs.points;
  }

  function submit() {
    if (!form.customerId) {
      toast.error("Sélectionnez un client.");
      return;
    }
    if (!validateForm()) return;

    try {
      const card = getCardByCustomer(form.customerId, MERCHANT_ID);
      if (!card) {
        toast.error("Ce client n'a pas de carte de fidélité.", {
          description: "Créez d'abord une carte pour ce client.",
        });
        return;
      }

      addPoints(
        card.id,
        Number(form.points),
        MERCHANT_ID,
        STORE_ID,
        form.reason.trim() || `Ajout manuel — ${MERCHANT_NAME}`,
        MERCHANT_ID,
      );

      setOpen(false);
      setForm({ customerId: "", points: "", reason: "" });
      setFormError({ points: "" });
      refresh();
      toast.success(`${form.points} points ajoutés à ${getCustomerName(form.customerId)}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue.";
      toast.error(msg);
    }
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every point earned, redeemed or adjusted."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button id="btn-add-points-tx">
                <Plus className="size-4" /> Add Points
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add points</DialogTitle>
                <DialogDescription>Reward a customer for a purchase or visit.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm({ ...form, customerId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {realCustomers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Aucun client enregistré
                        </SelectItem>
                      ) : (
                        realCustomers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-points">Points</Label>
                  <Input
                    id="tx-points"
                    inputMode="numeric"
                    placeholder="20"
                    value={form.points}
                    onChange={(e) => {
                      setForm({ ...form, points: e.target.value });
                      if (formError.points) {
                        const v = validatePointsToAdd(Number(e.target.value));
                        setFormError({ points: v.error ?? "" });
                      }
                    }}
                  />
                  {formError.points && (
                    <p className="text-xs text-destructive">{formError.points}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tx-reason">Reason</Label>
                  <Input
                    id="tx-reason"
                    placeholder="Purchase €20.00"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit}>Add Points</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Receipt}
              title="No transactions"
              description={
                realTransactions.length === 0
                  ? "Aucune transaction. Ajoutez des points depuis le scanner ou la page clients."
                  : "Nothing matches this filter yet."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(t.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{getCustomerName(t.customerId)}</TableCell>
                    <TableCell>
                      <StatusBadge status="earned" />
                    </TableCell>
                    <TableCell
                      className={
                        t.pointsAdded >= 0
                          ? "text-right font-medium text-success"
                          : "text-right font-medium text-destructive"
                      }
                    >
                      {t.pointsAdded > 0 ? `+${t.pointsAdded}` : t.pointsAdded}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="completed" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewCardDialog open={newCardOpen} onOpenChange={setNewCardOpen} onCreated={refresh} />
    </>
  );
}
