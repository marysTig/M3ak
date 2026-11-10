import { createFileRoute } from "@tanstack/react-router";
import { Calendar, CheckCircle2, Clock, PowerOff, Search, Store, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activateMerchant, deleteMerchant, getAllMerchants, setMerchantStatus } from "@/lib/db/merchants";
import type { ActivationDuration } from "@/lib/db/merchants";

const filters = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "suspended", label: "Désactivés" },
  { value: "pending", label: "En attente" },
  { value: "expired", label: "Expirés" },
] as const;

interface MerchantRow {
  id: string;
  name: string;
  category: string | null;
  owner_id: string;
  plan: string;
  status: "active" | "pending" | "suspended";
  subscription_expires_at: string | null;
  customers: number;
  joined: string;
}

function formatExpiry(expiresAt: string | null): { label: string; expired: boolean; soon: boolean } {
  if (!expiresAt) return { label: "—", expired: false, soon: false };
  const exp = new Date(expiresAt);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const expired = diff < 0;
  const soon = !expired && days <= 7;
  const label = expired
    ? `Expiré le ${exp.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`
    : `${exp.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} (${days}j)`;
  return { label, expired, soon };
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

  // Activation dialog state
  const [businessToActivate, setBusinessToActivate] = useState<MerchantRow | null>(null);
  const [activationDuration, setActivationDuration] = useState<ActivationDuration>("1month");
  const [activating, setActivating] = useState(false);

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
        subscription_expires_at: (m as any).subscription_expires_at ?? null,
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

  async function handleActivate() {
    if (!businessToActivate) return;
    setActivating(true);
    try {
      const updated = await activateMerchant(businessToActivate.id, activationDuration);
      setRows((prev) => prev.map((r) => r.id === businessToActivate.id
        ? { ...r, status: "active", subscription_expires_at: (updated as any).subscription_expires_at }
        : r
      ));
      const durationLabel = activationDuration === "1year" ? "1 an" : "1 mois";
      toast.success(`${businessToActivate.name} activé pour ${durationLabel}`);
      setBusinessToActivate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'activation.");
    } finally {
      setActivating(false);
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
    const now = new Date();
    return rows.filter((b) => {
      const isExpired = b.subscription_expires_at && new Date(b.subscription_expires_at) < now && b.status === "active";
      const statusMatch =
        filter === "all" ? true :
        filter === "expired" ? !!isExpired :
        filter === "active" ? b.status === "active" && !isExpired :
        b.status === filter;
      const matchQuery = !q || `${b.name} ${b.category ?? ""}`.toLowerCase().includes(q);
      return statusMatch && matchQuery;
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
          <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto overflow-x-auto">
            <TabsList className="w-full sm:w-auto inline-flex">
              {filters.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="text-xs sm:text-sm px-2 sm:px-3 whitespace-nowrap">
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
                  <TableHead className="hidden sm:table-cell">Activation expire</TableHead>
                  <TableHead className="hidden lg:table-cell">Inscription</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((b) => {
                  const now = new Date();
                  const isExpired = b.subscription_expires_at && new Date(b.subscription_expires_at) < now;
                  const isActive = b.status === "active" && !isExpired;
                  const isUpdating = updatingId === b.id;
                  const expiry = formatExpiry(b.subscription_expires_at);

                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{b.category ?? "Commerce général"}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">{b.customers.toLocaleString()}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {b.subscription_expires_at ? (
                          <span className={`flex items-center gap-1.5 text-xs ${expiry.expired ? "text-destructive font-medium" : expiry.soon ? "text-warning font-medium" : "text-muted-foreground"}`}>
                            <Clock className="size-3 shrink-0" />
                            {expiry.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">{b.joined}</TableCell>
                      <TableCell>
                        <StatusBadge
                          status={isExpired ? "Expiré" : isActive ? "Actif" : b.status === "suspended" ? "Désactivé" : "En attente"}
                          tone={isExpired ? "warning" : isActive ? "success" : b.status === "suspended" ? "danger" : "warning"}
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
                              onClick={() => { setBusinessToActivate(b); setActivationDuration("1month"); }}
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

      {/* ── Dialogue d'activation ── */}
      <AlertDialog
        open={!!businessToActivate}
        onOpenChange={(open) => { if (!open && !activating) setBusinessToActivate(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              Activer {businessToActivate?.name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground">
                  Choisissez la durée d'activation pour ce commerce.
                </p>
                {/* Choix de durée */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActivationDuration("1month")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-colors ${
                      activationDuration === "1month"
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface-muted text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Calendar className="size-6" />
                    <span className="font-semibold text-sm">1 mois</span>
                    <span className="text-xs opacity-70">30 jours</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivationDuration("1year")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 transition-colors ${
                      activationDuration === "1year"
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-surface-muted text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    <Calendar className="size-6" />
                    <span className="font-semibold text-sm">1 an</span>
                    <span className="text-xs opacity-70">365 jours</span>
                  </button>
                </div>
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                  <strong>Expiration :</strong>{" "}
                  {activationDuration === "1year"
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                  }
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleActivate(); }}
              disabled={activating}
              className="bg-success text-white hover:bg-success/90"
            >
              {activating ? "Activation…" : `Activer pour ${activationDuration === "1year" ? "1 an" : "1 mois"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogue de suppression ── */}
      <AlertDialog
        open={!!businessToDelete}
        onOpenChange={(open) => { if (!open && !deleting) setBusinessToDelete(null); }}
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
              onClick={(e) => { e.preventDefault(); if (businessToDelete) handleDelete(businessToDelete); }}
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
