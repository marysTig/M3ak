import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Power, PowerOff, Search, Store, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteMerchant, getAllMerchants, setMerchantStatus } from "@/lib/db/merchants";

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
  const [businessToDelete, setBusinessToDelete] = useState<MerchantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete(b: MerchantRow) {
    setDeleting(true);
    try {
      await deleteMerchant(b.id, b.owner_id);
      setRows((prev) => prev.filter((r) => r.id !== b.id));
      toast.success(`Le commerce "${b.name}" et son compte ont été supprimés définitivement.`);
      setBusinessToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression définitive.");
    } finally {
      setDeleting(false);
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
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Commerces"
        subtitle="Consultez, activez ou désactivez les comptes des commerces."
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un commerce..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
              {filters.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="text-xs sm:text-sm px-2 sm:px-3">
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
                              className="text-muted-foreground hover:bg-muted text-xs"
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

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating || deleting}
                            onClick={() => setBusinessToDelete(b)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
                            title="Supprimer définitivement"
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only sm:not-sr-only sm:ml-1">Supprimer</span>
                          </Button>

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
                                  className="text-muted-foreground"
                                  onClick={() => handleDeactivate(b)}
                                >
                                  <PowerOff className="mr-2 size-4" />
                                  Désactiver le compte
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => setBusinessToDelete(b)}
                              >
                                <Trash2 className="mr-2 size-4" />
                                Supprimer définitivement
                              </DropdownMenuItem>
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

      {/* Boîte de dialogue de confirmation de suppression définitive */}
      <AlertDialog
        open={!!businessToDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setBusinessToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Supprimer définitivement ce commerce ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2 text-left">
              <div>
                Êtes-vous sûr de vouloir supprimer définitivement le commerce{" "}
                <strong className="text-foreground">{businessToDelete?.name}</strong> ?
              </div>
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                <strong>Attention : Cette action est irréversible.</strong>
                <p className="mt-1 text-muted-foreground">
                  Le compte utilisateur associé, ses cartes de fidélité, les récompenses créées ainsi que l'historique complet des transactions seront définitivement supprimés.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (businessToDelete) {
                  handleDelete(businessToDelete);
                }
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
