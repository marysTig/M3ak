import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Power, PowerOff, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllMerchants, setMerchantStatus } from "@/lib/db/merchants";

const filters = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "suspended", label: "Désactivés" },
  { value: "pending", label: "En attente" },
] as const;

interface MerchantRow {
  id: string;
  name: string;
  category: string | null;
  owner_id: string;
  plan: string;
  status: "active" | "pending" | "suspended";
  customers: number;
  joined: string;
}

export const Route = createFileRoute("/admin/businesses")({
  head: () => ({
    meta: [
      { title: "Commerces — M3ak Admin" },
      { name: "description", content: "Gestion, activation et désactivation des commerces." },
      { property: "og:title", content: "Commerces — M3ak Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBusinesses,
});

function AdminBusinesses() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await getAllMerchants();
      const mapped = (data as (typeof data[0] & { loyalty_cards: { count: number }[] })[]).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        owner_id: m.owner_id,
        plan: m.plan,
        status: m.status,
        customers: Array.isArray(m.loyalty_cards) ? m.loyalty_cards.length : 0,
        joined: new Date(m.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      }));
      setRows(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleActivate(b: MerchantRow) {
    setUpdatingId(b.id);
    try {
      await setMerchantStatus(b.id, "active");
      setRows((prev) => prev.map((r) => r.id === b.id ? { ...r, status: "active" } : r));
      toast.success(`${b.name} activé avec succès`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'activation.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDeactivate(b: MerchantRow) {
    setUpdatingId(b.id);
    try {
      await setMerchantStatus(b.id, "suspended");
      setRows((prev) => prev.map((r) => r.id === b.id ? { ...r, status: "suspended" } : r));
      toast.success(`${b.name} a été désactivé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la désactivation.");
    } finally {
      setUpdatingId(null);
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((b) => {
      const matchFilter = filter === "all" || b.status === filter;
      const matchQuery = !q || `${b.name} ${b.category ?? ""}`.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [rows, query, filter]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <PageHeader
        title="Commerces"
        subtitle="Consultez, activez ou désactivez les comptes des commerces."
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un commerce..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.value} value={f.value}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Store}
              title="Aucun commerce trouvé"
              description={rows.length === 0 ? "Aucun commerce enregistré pour le moment." : "Essayez une autre recherche ou filtre."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commerce</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Inscription</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((b) => {
                  const isActive = b.status === "active";
                  const isUpdating = updatingId === b.id;

                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.category ?? "Commerce général"}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">{b.customers.toLocaleString()}</TableCell>
                      <TableCell className="hidden sm:table-cell capitalize">{b.plan}</TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{b.joined}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={isActive ? "Actif" : b.status === "suspended" ? "Désactivé" : "En attente"}
                          tone={isActive ? "success" : b.status === "suspended" ? "danger" : "warning"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleDeactivate(b)}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                            >
                              <PowerOff className="mr-1.5 size-3.5" />
                              Désactiver
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleActivate(b)}
                              className="text-success hover:bg-success/10 hover:text-success text-xs"
                            >
                              <CheckCircle2 className="mr-1.5 size-3.5" />
                              Activer
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">Options</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isActive && (
                                <DropdownMenuItem onClick={() => handleActivate(b)}>
                                  <Power className="mr-2 size-4 text-success" />
                                  Activer le compte
                                </DropdownMenuItem>
                              )}
                              {isActive && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeactivate(b)}
                                >
                                  <PowerOff className="mr-2 size-4" />
                                  Désactiver le compte
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
