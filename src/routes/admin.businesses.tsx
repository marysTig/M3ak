import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  MessageCircle,
  Phone,
  Plus,
  PowerOff,
  Search,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  activateMerchant,
  deleteMerchant,
  getAllMerchants,
  setMerchantStatus,
  type ActivationDuration,
} from "@/lib/db/merchants";
import {
  deleteSubscriptionPayment,
  getSubscriptionPayments,
  recordSubscriptionPayment,
  type PaymentMethod,
  type SubscriptionPayment,
} from "@/lib/db/payments";
import { cn } from "@/lib/utils";

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
  phone: string | null;
  plan: string;
  status: "active" | "pending" | "suspended";
  subscription_expires_at: string | null;
  customers: number;
  joined: string;
}

function formatExpiry(expiresAt: string | null): { label: string; expired: boolean; soon: boolean; days: number } {
  if (!expiresAt) return { label: "—", expired: false, soon: false, days: 999 };
  const exp = new Date(expiresAt);
  const now = new Date();
  const diff = exp.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const expired = diff < 0;
  const soon = !expired && days <= 7;
  const label = expired
    ? `Expiré (${Math.abs(days)}j)`
    : `${exp.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} (${days}j)`;
  return { label, expired, soon, days };
}

export const Route = createFileRoute("/admin/businesses")({
  head: () => ({
    meta: [
      { title: "Commerces & Encaissements — M3ak Admin" },
      { name: "description", content: "Gestion, activation, suivi financier et alertes d'expiration des commerces." },
      { property: "og:title", content: "Commerces & Encaissements — M3ak Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBusinesses,
});

function AdminBusinesses() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"businesses" | "finances">("businesses");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [businessToDelete, setBusinessToDelete] = useState<MerchantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sélecteur déroulant de commerce (Nom & Téléphone)
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");

  // Activation dialog state
  const [businessToActivate, setBusinessToActivate] = useState<MerchantRow | null>(null);
  const [activationDuration, setActivationDuration] = useState<ActivationDuration>("1year");
  const [activating, setActivating] = useState(false);

  // Formulaire d'encaissement
  const [payAmount, setPayAmount] = useState<string>("15000");
  const [payDuration, setPayDuration] = useState<ActivationDuration>("1year");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("cash");
  const [payNotes, setPayNotes] = useState<string>("");
  const [autoRenewSub, setAutoRenewSub] = useState<boolean>(true);
  const [recordingPayment, setRecordingPayment] = useState<boolean>(false);

  async function load() {
    try {
      const [merchantsData, paymentsData] = await Promise.all([
        getAllMerchants(),
        getSubscriptionPayments(),
      ]);

      const mapped: MerchantRow[] = (merchantsData as any[]).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        owner_id: m.owner_id,
        phone: m.phone || m.profiles?.phone || null,
        plan: m.plan,
        status: m.status,
        subscription_expires_at: m.subscription_expires_at ?? null,
        customers: Array.isArray(m.loyalty_cards) ? m.loyalty_cards.length : 0,
        joined: new Intl.DateTimeFormat("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(m.created_at)),
      }));

      setRows(mapped);
      setPayments(paymentsData);
      if (mapped.length > 0 && !selectedMerchantId) {
        setSelectedMerchantId(mapped[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Alerte automatique des commerces qui arrivent à expiration dans moins de 7 jours (ou déjà expirés)
  const expiringSoon = useMemo(() => {
    const now = Date.now();
    return rows.filter((b) => {
      if (!b.subscription_expires_at) return false;
      const expTime = new Date(b.subscription_expires_at).getTime();
      const diffMs = expTime - now;
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return days <= 7;
    });
  }, [rows]);

  // Commerce sélectionné dans la liste déroulante
  const currentSelectedMerchant = useMemo(() => {
    return rows.find((r) => r.id === selectedMerchantId) || rows[0] || null;
  }, [rows, selectedMerchantId]);

  // Total encaissé plateforme
  const totalRevenue = useMemo(() => {
    return payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [payments]);

  async function handleActivate() {
    if (!businessToActivate) return;
    setActivating(true);
    try {
      const updated = await activateMerchant(businessToActivate.id, activationDuration);
      setRows((prev) =>
        prev.map((r) =>
          r.id === businessToActivate.id
            ? { ...r, status: "active", subscription_expires_at: (updated as any).subscription_expires_at }
            : r
        )
      );
      const durationLabels: Record<ActivationDuration, string> = {
        "1month": "1 mois",
        "3months": "3 mois",
        "6months": "6 mois",
        "1year": "1 an",
      };
      toast.success(`${businessToActivate.name} activé pour ${durationLabels[activationDuration]}`);
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
      setRows((prev) => prev.map((r) => (r.id === b.id ? { ...r, status: "suspended" } : r)));
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
      toast.success(`Le commerce "${b.name}" a été supprimé définitivement.`);
      setBusinessToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentSelectedMerchant) {
      toast.error("Veuillez sélectionner un commerce.");
      return;
    }
    const amountNum = Number(payAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error("Veuillez entrer un montant valide.");
      return;
    }

    setRecordingPayment(true);
    try {
      const record = await recordSubscriptionPayment({
        merchant_id: currentSelectedMerchant.id,
        merchant_name: currentSelectedMerchant.name,
        merchant_phone: currentSelectedMerchant.phone,
        amount: amountNum,
        duration: payDuration,
        payment_method: payMethod,
        notes: payNotes.trim() || undefined,
      });

      setPayments((prev) => [record, ...prev]);

      // Si l'option de renouvellement automatique de l'abonnement est cochée
      if (autoRenewSub) {
        const updated = await activateMerchant(currentSelectedMerchant.id, payDuration);
        setRows((prev) =>
          prev.map((r) =>
            r.id === currentSelectedMerchant.id
              ? { ...r, status: "active", subscription_expires_at: (updated as any).subscription_expires_at }
              : r
          )
        );
      }

      toast.success(`Encaissement de ${amountNum.toLocaleString()} DA enregistré pour ${currentSelectedMerchant.name} !`);
      setPayNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'encaissement.");
    } finally {
      setRecordingPayment(false);
    }
  }

  async function handleDeletePayment(id: string) {
    if (!confirm("Voulez-vous supprimer cette ligne d'encaissement ?")) return;
    try {
      await deleteSubscriptionPayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      toast.success("Encaissement supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression.");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = new Date();
    return rows.filter((b) => {
      const isExpired = b.subscription_expires_at && new Date(b.subscription_expires_at) < now && b.status === "active";
      const statusMatch =
        filter === "all"
          ? true
          : filter === "expired"
          ? !!isExpired
          : filter === "active"
          ? b.status === "active" && !isExpired
          : b.status === filter;
      const matchQuery =
        !q ||
        `${b.name} ${b.category ?? ""} ${b.phone ?? ""}`.toLowerCase().includes(q);
      return statusMatch && matchQuery;
    });
  }, [rows, query, filter]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commerces & Encaissements"
        subtitle="Gestion des commerces, encaissements des abonnements et alertes d'expiration."
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* BANDEAU D'ALERTE : COMMERCES EXPIRANT DANS MOINS DE 7 JOURS     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {expiringSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm sm:text-base">
              <AlertTriangle className="size-5 shrink-0" />
              <span>
                Alerte Expiration : {expiringSoon.length} commerce{expiringSoon.length > 1 ? "s" : ""} dans les 7 jours
              </span>
            </div>
            <span className="text-xs text-amber-700/80 dark:text-amber-300 font-medium">
              Relancez le commerçant pour renouveler son abonnement
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {expiringSoon.map((b) => {
              const expiry = formatExpiry(b.subscription_expires_at);
              return (
                <div
                  key={b.id}
                  className="rounded-xl border border-amber-500/25 bg-background p-3 flex flex-col justify-between gap-2 shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm text-foreground truncate">{b.name}</p>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          expiry.expired
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {expiry.expired ? `Expiré (${Math.abs(expiry.days)}j)` : `${expiry.days}j restants`}
                      </span>
                    </div>

                    {b.phone ? (
                      <p className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-1.5">
                        <Phone className="size-3 text-primary" />
                        {b.phone}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mt-1">Aucun numéro enregistré</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                    {b.phone && (
                      <>
                        <a
                          href={`tel:${b.phone}`}
                          className="inline-flex h-7 items-center justify-center rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                          title="Appeler le commerçant"
                        >
                          <Phone className="size-3 mr-1" />
                          Appeler
                        </a>
                        <a
                          href={`https://wa.me/${b.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-7 items-center justify-center rounded-lg bg-[#25D366]/15 px-2 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
                          title="Contacter sur WhatsApp"
                        >
                          <MessageCircle className="size-3 mr-1" />
                          WhatsApp
                        </a>
                      </>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setBusinessToActivate(b);
                        setActivationDuration("1year");
                      }}
                      className="h-7 text-xs ml-auto font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Renouveler
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SÉLECTEUR DÉROULANT DE COMMERCE (NOM & NUMÉRO DE TÉLÉPHONE)   */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="card-surface p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <Label htmlFor="merchant-selector" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Store className="size-3.5 text-primary" />
              Sélection rapide d'un commerce (Nom & Téléphone)
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choisissez un commerce dans la liste déroulante pour consulter ses coordonnées ou enregistrer un encaissement.
            </p>
          </div>
          {currentSelectedMerchant && (
            <div className="flex items-center gap-1.5 shrink-0">
              {currentSelectedMerchant.phone && (
                <>
                  <a
                    href={`tel:${currentSelectedMerchant.phone}`}
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-surface-muted px-2.5 text-xs font-medium hover:bg-accent text-foreground transition-colors"
                  >
                    <Phone className="size-3.5 mr-1 text-primary" />
                    Appeler
                  </a>
                  <a
                    href={`https://wa.me/${currentSelectedMerchant.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-[#25D366]/15 px-2.5 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/25 transition-colors"
                  >
                    <MessageCircle className="size-3.5 mr-1" />
                    WhatsApp
                  </a>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setBusinessToActivate(currentSelectedMerchant);
                  setActivationDuration("1year");
                }}
                className="h-8 text-xs font-semibold text-success hover:bg-success/10 border-success/30"
              >
                Activer / Prolonger
              </Button>
            </div>
          )}
        </div>

        {/* LISTE DÉROULANTE (NOM ET NUMÉRO DE TÉLÉPHONE) */}
        <select
          id="merchant-selector"
          value={selectedMerchantId}
          onChange={(e) => setSelectedMerchantId(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-input bg-background font-medium text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
        >
          {rows.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.phone ? b.phone : "Sans numéro"}
            </option>
          ))}
        </select>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ONGLETS PRINCIPAUX : TOUS LES COMMERCES vs SUIVI FINANCIER     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="businesses" className="text-xs sm:text-sm font-semibold">
            <Store className="size-4 mr-1.5" />
            Tous les commerces ({rows.length})
          </TabsTrigger>
          <TabsTrigger value="finances" className="text-xs sm:text-sm font-semibold">
            <Wallet className="size-4 mr-1.5" />
            Suivi Financier & Encaissements
          </TabsTrigger>
        </TabsList>

        {/* ── ONGLET 1 : TOUS LES COMMERCES ── */}
        {activeTab === "businesses" && (
          <div className="card-surface overflow-hidden space-y-0">
            <div className="flex flex-col gap-3 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between border-b">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou tél..."
                  className="pl-9 h-9 text-xs sm:text-sm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto overflow-x-auto">
                <TabsList className="w-full sm:w-auto inline-flex">
                  {filters.map((f) => (
                    <TabsTrigger key={f.value} value={f.value} className="text-xs px-2.5 sm:px-3 whitespace-nowrap">
                      {f.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {visible.length === 0 ? (
              <div className="p-6">
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
                      <TableHead>Commerce & Contact</TableHead>
                      <TableHead className="text-right">Clients</TableHead>
                      <TableHead className="hidden sm:table-cell">Abonnement expire</TableHead>
                      <TableHead className="hidden md:table-cell">Créé & Activé le</TableHead>
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
                        <TableRow key={b.id} className="hover:bg-accent/40">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm text-foreground">{b.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {b.phone ? (
                                  <a
                                    href={`tel:${b.phone}`}
                                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                                    title="Appeler"
                                  >
                                    <Phone className="size-3 shrink-0" />
                                    {b.phone}
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground/60 italic">Sans numéro</span>
                                )}
                                <span className="text-[10px] text-muted-foreground">· {b.category ?? "Général"}</span>
                              </div>
                              <div className="md:hidden mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="size-3 text-primary/70 shrink-0" />
                                <span>Activé le {b.joined}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{b.customers.toLocaleString()}</TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {b.subscription_expires_at ? (
                              <span
                                className={cn(
                                  "flex items-center gap-1.5 text-xs font-medium",
                                  expiry.expired ? "text-destructive font-bold" : expiry.soon ? "text-amber-600 dark:text-amber-400 font-bold" : "text-muted-foreground"
                                )}
                              >
                                <Clock className="size-3 shrink-0" />
                                {expiry.label}
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 className="size-3 shrink-0" />
                                Actif immédiat
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="size-3.5 text-primary/70 shrink-0" />
                              <span className="font-medium text-foreground">{b.joined}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={isExpired ? "Expiré" : isActive ? "Actif" : b.status === "suspended" ? "Désactivé" : "En attente"}
                              tone={isExpired ? "warning" : isActive ? "success" : b.status === "suspended" ? "danger" : "warning"}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isActive ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() => handleDeactivate(b)}
                                  className="text-muted-foreground hover:bg-muted text-xs h-7 px-2"
                                  title="Désactiver l'accès du commerce"
                                >
                                  <PowerOff className="size-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Désactiver</span>
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    setBusinessToActivate(b);
                                    setActivationDuration("1year");
                                  }}
                                  className="text-success hover:bg-success/10 hover:text-success text-xs h-7 px-2"
                                  title="Activer ou renouveler l'abonnement"
                                >
                                  <CheckCircle2 className="size-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Activer</span>
                                </Button>
                              )}

                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isUpdating || deleting}
                                onClick={() => setBusinessToDelete(b)}
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-7 w-7 p-0"
                                title="Supprimer définitivement"
                              >
                                <Trash2 className="size-3.5" />
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
        )}

        {/* ── ONGLET 2 : SUIVI FINANCIER & ENCAISSEMENTS ── */}
        {activeTab === "finances" && (
          <div className="space-y-6">
            {/* Statistiques Financières */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="card-surface p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="size-3.5 text-emerald-600" />
                  Total Encaissé
                </p>
                <p className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                  {totalRevenue.toLocaleString("fr-FR")}{" "}
                  <span className="text-sm font-normal text-muted-foreground">DA</span>
                </p>
                <p className="text-[11px] text-muted-foreground">Revenus cumulés sur la plateforme</p>
              </div>

              <div className="card-surface p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Store className="size-3.5 text-primary" />
                  Commerces Actifs
                </p>
                <p className="font-display text-2xl sm:text-3xl font-extrabold text-primary">
                  {rows.filter((r) => r.status === "active").length} / {rows.length}
                </p>
                <p className="text-[11px] text-muted-foreground">Commerces avec licence active</p>
              </div>

              <div className="card-surface p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-amber-500" />
                  Nombre d'Encaissements
                </p>
                <p className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                  {payments.length}
                </p>
                <p className="text-[11px] text-muted-foreground">Règlements enregistrés</p>
              </div>
            </div>

            {/* Formulaire d'Enregistrement d'un Encaissement */}
            <form onSubmit={handleRecordPayment} className="card-surface p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="size-5 text-primary" />
                  <h3 className="font-bold text-sm sm:text-base">Enregistrer un nouvel encaissement</h3>
                </div>
                <span className="text-xs text-muted-foreground">Abonnement & Licence</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Commerce (Liste déroulante Nom & Téléphone) */}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-merchant" className="text-xs font-semibold">
                    Commerce bénéficiaire (Nom — Téléphone) *
                  </Label>
                  <select
                    id="pay-merchant"
                    value={selectedMerchantId}
                    onChange={(e) => setSelectedMerchantId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary"
                    required
                  >
                    {rows.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.phone || "Sans numéro"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Montant (DA) avec boutons raccourcis */}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount" className="text-xs font-semibold">
                    Montant encaissé (DA) *
                  </Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="ex: 15000"
                    className="h-10 text-xs sm:text-sm font-mono"
                    required
                  />
                  <div className="flex gap-1.5 pt-0.5 flex-wrap">
                    {[
                      { label: "15 000 DA (1 an)", val: "15000", dur: "1year" as ActivationDuration },
                      { label: "2 500 DA (1 mois)", val: "2500", dur: "1month" as ActivationDuration },
                      { label: "7 000 DA (3 mois)", val: "7000", dur: "3months" as ActivationDuration },
                      { label: "12 000 DA (6 mois)", val: "12000", dur: "6months" as ActivationDuration },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          setPayAmount(item.val);
                          setPayDuration(item.dur);
                        }}
                        className="px-2 py-0.5 rounded-md bg-surface-muted text-[10px] font-medium hover:bg-accent text-foreground transition-colors"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Durée couverte */}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-duration" className="text-xs font-semibold">
                    Période d'activation *
                  </Label>
                  <select
                    id="pay-duration"
                    value={payDuration}
                    onChange={(e) => setPayDuration(e.target.value as ActivationDuration)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs sm:text-sm font-medium"
                  >
                    <option value="1year">1 An (365 jours)</option>
                    <option value="6months">6 Mois (180 jours)</option>
                    <option value="3months">3 Mois (90 jours)</option>
                    <option value="1month">1 Mois (30 jours)</option>
                  </select>
                </div>

                {/* Mode de règlement */}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method" className="text-xs font-semibold">
                    Mode de paiement *
                  </Label>
                  <select
                    id="pay-method"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs sm:text-sm font-medium"
                  >
                    <option value="cash">💵 Espèces (Cash)</option>
                    <option value="baridimob">📱 BaridiMob</option>
                    <option value="ccp">📮 Virement CCP</option>
                    <option value="check">🧾 Chèque bancaire</option>
                    <option value="transfer">🏦 Virement bancaire</option>
                  </select>
                </div>
              </div>

              {/* Notes / Réf */}
              <div className="space-y-1.5">
                <Label htmlFor="pay-notes" className="text-xs font-semibold">
                  Notes ou Référence de reçu (optionnel)
                </Label>
                <Input
                  id="pay-notes"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="ex: Reçu N° 4589, règlement boutique, BaridiMob ref..."
                  className="h-10 text-xs sm:text-sm"
                />
              </div>

              {/* Checkbox auto-renouvellement de l'abonnement */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="auto-renew"
                  checked={autoRenewSub}
                  onChange={(e) => setAutoRenewSub(e.target.checked)}
                  className="size-4 rounded border-input text-primary focus:ring-primary"
                />
                <Label htmlFor="auto-renew" className="text-xs font-medium cursor-pointer">
                  Activer ou prolonger automatiquement l'abonnement du commerce pour cette durée
                </Label>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={recordingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-5 h-10"
                >
                  <Plus className="size-4 mr-1.5" />
                  {recordingPayment ? "Enregistrement…" : "Enregistrer l'encaissement"}
                </Button>
              </div>
            </form>

            {/* Tableau de l'Historique des Encaissements */}
            <div className="card-surface overflow-hidden space-y-0">
              <div className="p-4 border-b flex items-center justify-between">
                <h4 className="font-bold text-sm">Historique des encaissements</h4>
                <span className="text-xs text-muted-foreground">{payments.length} règlement(s) enregistré(s)</span>
              </div>

              {payments.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Wallet}
                    title="Aucun encaissement enregistré"
                    description="Utilisez le formulaire ci-dessus pour enregistrer le premier règlement d'abonnement d'un commerce."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Commerce (Nom & Téléphone)</TableHead>
                        <TableHead className="text-right">Montant (DA)</TableHead>
                        <TableHead>Durée</TableHead>
                        <TableHead>Mode de règlement</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const methodLabels: Record<PaymentMethod, string> = {
                          cash: "💵 Espèces",
                          baridimob: "📱 BaridiMob",
                          ccp: "📮 CCP",
                          check: "🧾 Chèque",
                          transfer: "🏦 Virement",
                        };

                        const durationLabels: Record<ActivationDuration, string> = {
                          "1month": "1 mois",
                          "3months": "3 mois",
                          "6months": "6 mois",
                          "1year": "1 an",
                        };

                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {new Date(p.created_at).toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              <p className="font-semibold text-xs sm:text-sm text-foreground">{p.merchant_name}</p>
                              {p.merchant_phone && (
                                <p className="text-xs text-muted-foreground font-mono">{p.merchant_phone}</p>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold font-mono text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                              {p.amount.toLocaleString("fr-FR")} DA
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {durationLabels[p.duration] || p.duration}
                            </TableCell>
                            <TableCell className="text-xs">
                              {methodLabels[p.payment_method] || p.payment_method}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {p.notes || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePayment(p.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Supprimer cet encaissement"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </Tabs>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* DIALOGUE D'ACTIVATION / PROLONGATION                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <AlertDialog
        open={!!businessToActivate}
        onOpenChange={(open) => {
          if (!open && !activating) setBusinessToActivate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="size-5" />
              Activer / Renouveler {businessToActivate?.name}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 pt-1">
                <p className="text-sm text-muted-foreground">
                  Choisissez la durée d'activation pour ce commerce.
                  {businessToActivate?.phone && (
                    <span className="block font-mono text-foreground font-medium mt-1">
                      Téléphone : {businessToActivate.phone}
                    </span>
                  )}
                </p>

                {/* Choix de durée */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "1month" as ActivationDuration, label: "1 mois", sub: "30 jours" },
                    { id: "3months" as ActivationDuration, label: "3 mois", sub: "90 jours" },
                    { id: "6months" as ActivationDuration, label: "6 mois", sub: "180 jours" },
                    { id: "1year" as ActivationDuration, label: "1 an", sub: "365 jours" },
                  ].map((dur) => (
                    <button
                      key={dur.id}
                      type="button"
                      onClick={() => setActivationDuration(dur.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors",
                        activationDuration === dur.id
                          ? "border-primary bg-primary-soft text-primary"
                          : "border-border bg-surface-muted text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      <Calendar className="size-5" />
                      <span className="font-semibold text-xs sm:text-sm">{dur.label}</span>
                      <span className="text-[10px] opacity-70">{dur.sub}</span>
                    </button>
                  ))}
                </div>

                <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                  <strong>Nouvelle date d'expiration :</strong>{" "}
                  {activationDuration === "1year"
                    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : activationDuration === "6months"
                    ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : activationDuration === "3months"
                    ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={activating}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleActivate();
              }}
              disabled={activating}
              className="bg-success text-white hover:bg-success/90"
            >
              {activating ? "Activation…" : "Confirmer l'activation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialogue de suppression ── */}
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
                  Le compte utilisateur associé, ses cartes de fidélité, les récompenses créées ainsi que l'historique
                  complet des transactions seront définitivement supprimés.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (businessToDelete) handleDelete(businessToDelete);
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
