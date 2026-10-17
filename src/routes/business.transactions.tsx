import { createFileRoute } from "@tanstack/react-router";
import { Plus, Receipt, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NewCardDialog } from "@/components/app/new-card-dialog";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getMerchantTransactions, type Transaction } from "@/lib/db/transactions";

export const Route = createFileRoute("/business/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — M3ak Loyalty" },
      { name: "description", content: "Historique des points gagnés, échangés et ajustés." },
      { property: "og:title", content: "Transactions — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const filterTabs = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "redeemed", label: "Redeemed" },
] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function TransactionsPage() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [newCardOpen, setNewCardOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id").eq("owner_id", user.id).single();
      if (m) {
        setMerchantId(m.id);
        const tx = await getMerchantTransactions(m.id);
        setTransactions(tx);
      }
      setLoading(false);
    });
  }, []);

  async function reload() {
    if (!merchantId) return;
    const tx = await getMerchantTransactions(merchantId);
    setTransactions(tx);
  }

  const visible = useMemo(() => {
    let list = transactions;
    if (filter !== "all") {
      list = list.filter((t) => t.tx_type === filter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, filter, query]);

  function txBadgeStatus(tx: Transaction): "active" | "pending" {
    return tx.points_delta > 0 ? "active" : "pending";
  }

  function pointsLabel(tx: Transaction) {
    const sign = tx.points_delta > 0 ? "+" : "";
    return `${sign}${tx.points_delta}`;
  }

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={`${transactions.length} transaction${transactions.length !== 1 ? "s" : ""} enregistrée${transactions.length !== 1 ? "s" : ""}`}
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
            <Input placeholder="Rechercher…" className="pl-9" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {filterTabs.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>{f.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Receipt}
              title="Aucune transaction trouvée"
              description={transactions.length === 0
                ? "Les transactions apparaîtront ici dès que vous ajouterez des points à un client."
                : "Essayez un autre filtre."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Nouveau solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                    <TableCell>
                      <StatusBadge status={txBadgeStatus(t)} />
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${t.points_delta > 0 ? "text-success" : "text-destructive"}`}>
                      {pointsLabel(t)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                      {t.new_balance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={reload}
      />
    </>
  );
}
