import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Edit2,
  Gift,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { NewCardDialog } from "@/components/app/new-card-dialog";
import { PageHeader } from "@/components/app/page-header";
import { VirtualCard, themes } from "@/routes/business.program";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { getMerchantCustomers, type CustomerWithCard } from "@/lib/db/customers";
import { addPoints, addStamps, redeemStamps, addVipSpending, resetCardPoints, deleteCustomerCard } from "@/lib/db/cards";
import { getCardTransactions } from "@/lib/db/transactions";
import type { Transaction } from "@/lib/db/transactions";
import { getLoyaltyProgram } from "@/lib/db/program";
import { getMyMerchant } from "@/lib/db/merchants";
import { cn } from "@/lib/utils";

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

function initials(name: string) {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "CL";
}

function normalizeText(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesCustomer(c: CustomerWithCard, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;

  const qNorm = normalizeText(q);
  const nameNorm = normalizeText(c.customer.full_name);

  // 1. Recherche par nom (multi-mots et insensible aux accents)
  const qWords = qNorm.split(/\s+/).filter(Boolean);
  if (qWords.length > 0 && qWords.every((w) => nameNorm.includes(w))) {
    return true;
  }

  // 2. Recherche par numéro de téléphone (formats variés: 07..., +213..., 213..., espaces)
  const qDigits = q.replace(/\D/g, "");
  const phoneDigits = (c.customer.phone || "").replace(/\D/g, "");
  if (qDigits.length >= 2 && phoneDigits.length >= 2) {
    if (phoneDigits.includes(qDigits)) return true;
    const localPhone = phoneDigits.startsWith("213") ? "0" + phoneDigits.slice(3) : phoneDigits;
    const intlPhone = phoneDigits.startsWith("0") ? "213" + phoneDigits.slice(1) : phoneDigits;
    if (localPhone.includes(qDigits) || intlPhone.includes(qDigits)) return true;
  }

  // 3. Recherche par token de carte ou lien
  const token = (c.card?.qr_token || "").toLowerCase();
  if (token && (token.includes(qNorm) || qNorm.includes(token))) {
    return true;
  }

  return false;
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
  const [selected, setSelected] = useState<CustomerWithCard | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);
  const [deletingCard, setDeletingCard] = useState(false);

  // Actions VIP
  const [vipSpendInput, setVipSpendInput] = useState("");
  const [addingVipSpend, setAddingVipSpend] = useState(false);

  // Actions Tampons
  const [stampsAdding, setStampsAdding] = useState(false);
  const [redeemingReward, setRedeemingReward] = useState(false);

  const [cardTx, setCardTx] = useState<Transaction[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Édition du numéro de téléphone du client
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

  async function handleSavePhone() {
    if (!selected) return;
    setSavingPhone(true);
    try {
      const cleanPhone = phoneInput.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ phone: cleanPhone || null })
        .eq("id", selected.customer.id);
      if (error) throw error;
      toast.success("Numéro de téléphone enregistré !");
      setSelected((prev) => (prev ? { ...prev, customer: { ...prev.customer, phone: cleanPhone } } : null));
      if (merchantId) await reload(merchantId);
      setEditingPhone(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setSavingPhone(false);
    }
  }

  function buildCardLink(qrToken: string) {
    return `${window.location.origin}/card/${qrToken}`;
  }

  async function handleCopyLink(qrToken: string) {
    try {
      await navigator.clipboard.writeText(buildCardLink(qrToken));
      setCopiedToken(qrToken);
      toast.success("Lien copié !");
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error("Impossible de copier.");
    }
  }

  function handleShareWhatsApp(c: CustomerWithCard) {
    const link = buildCardLink(c.card.qr_token);
    const msg = encodeURIComponent(
      `Bonjour ${c.customer.full_name} , Voici votre carte de fidélité *${merchantName}* : ${link}\n Ouvrez ce lien pour voir vos points et récompenses`
    );
    let waPhone = "";
    if (c.customer.phone) {
      let digits = c.customer.phone.replace(/\D/g, "");
      if (digits.startsWith("0")) digits = "213" + digits.slice(1);
      else if (digits.startsWith("2130")) digits = "213" + digits.slice(4);
      else if (!digits.startsWith("213") && digits.length === 9) digits = "213" + digits;
      waPhone = digits;
    }
    const url = waPhone ? `https://wa.me/${waPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleShareSMS(c: CustomerWithCard) {
    const link = buildCardLink(c.card.qr_token);
    const body = encodeURIComponent(
      `Bonjour ${c.customer.full_name} , Voici votre carte de fidélité *${merchantName}* : ${link}\n Ouvrez ce lien pour voir vos points et récompenses`
    );
    const smsPhone = c.customer.phone?.trim().replace(/\s+/g, "") || "";
    const url = smsPhone ? `sms:${smsPhone}?body=${body}` : `sms:?body=${body}`;
    window.open(url, "_self");
  }

  const reload = useCallback(async (mId: string) => {
    const data = await getMerchantCustomers(mId);
    setCustomers(data);
  }, []);

  useEffect(() => {
    getMyMerchant().then(async (m) => {
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
    return customers.filter((c) => matchesCustomer(c, query));
  }, [customers, query]);

  async function openSheet(c: CustomerWithCard) {
    setSelected(c);
    setPointsInput("");
    setPointsError("");
    setVipSpendInput("");
    setEditingPhone(false);
    setPhoneInput(c.customer.phone || "");
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

  async function handleResetCustomerPoints(c: CustomerRow) {
    if (!merchantId) return;
    if (c.card.points === 0) {
      toast.info("Le solde est déjà à 0 point.");
      return;
    }
    const currentPoints = c.card.points;
    const confirmed = window.confirm(
      `Confirmez-vous la remise à zéro des points de ${c.customer.full_name} (${currentPoints} pts actuellement) ?`
    );
    if (!confirmed) return;

    setResettingPoints(true);
    try {
      await resetCardPoints(c.card.id);
      toast.success(`Points remis à 0 pour ${c.customer.full_name} !`, {
        description: `L'ancien solde de ${currentPoints} pts a été réinitialisé.`,
      });
      if (merchantId) await reload(merchantId);
      if (selected && selected.card.id === c.card.id) {
        setSelected((prev) => (prev ? { ...prev, card: { ...prev.card, points: 0 } } : null));
        const tx = await getCardTransactions(c.card.id);
        setCardTx(tx.slice(0, 10));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la remise à zéro.");
    } finally {
      setResettingPoints(false);
    }
  }

  async function handleResetPoints() {
    if (!selected) return;
    await handleResetCustomerPoints(selected);
  }

  async function handleDeleteCard(c: CustomerWithCard) {
    if (!merchantId) return;
    const confirmed = window.confirm(
      `Supprimer définitivement la carte de ${c.customer.full_name} ?\n\nCette action supprimera la carte et tout l'historique des points de ce client pour votre commerce. Elle est irréversible.`
    );
    if (!confirmed) return;

    setDeletingCard(true);
    try {
      await deleteCustomerCard(c.card.id);
      toast.success(`Carte de ${c.customer.full_name} supprimée.`);
      setSelected(null);
      if (merchantId) await reload(merchantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    } finally {
      setDeletingCard(false);
    }
  }

  async function handleAddVipSpend(e?: React.FormEvent, directAmount?: number) {
    if (e) e.preventDefault();
    if (!selected || !merchantId) return;
    const amount = directAmount ?? Number(vipSpendInput);
    if (!amount || amount <= 0) {
      toast.error("Veuillez saisir un montant d'achat valide.");
      return;
    }
    setAddingVipSpend(true);
    try {
      const res = await addVipSpending({ cardId: selected.card.id, amount });
      if (res.tierUpgraded) {
        toast.success(`🎉 Félicitations ! ${selected.customer.full_name} passe au niveau ${res.newTier.toUpperCase()} !`, {
          description: `Total achats : ${res.newSpent.toLocaleString()} DA`,
        });
      } else {
        toast.success(`+${amount.toLocaleString()} DA enregistrés`, {
          description: `Total achats : ${res.newSpent.toLocaleString()} DA (Niveau ${res.newTier.toUpperCase()})`,
        });
      }
      setVipSpendInput("");
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              card: {
                ...prev.card,
                vip_spent: res.newSpent,
                vip_tier: res.newTier,
              },
            }
          : null
      );
      if (merchantId) await reload(merchantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'enregistrement de l'achat.");
    } finally {
      setAddingVipSpend(false);
    }
  }

  async function handleAddStamps(count: number = 1) {
    if (!selected || !merchantId) return;
    setStampsAdding(true);
    try {
      const res = await addStamps({ cardId: selected.card.id, count });
      if (res.completed) {
        toast.success(`🎉 Carte complétée pour ${selected.customer.full_name} !`, {
          description: `Récompense débloquée : ${selected.card.stamp_reward || "Cadeau offert"}`,
        });
      } else {
        toast.success(`+${count} tampon${count > 1 ? "s" : ""} validé${count > 1 ? "s" : ""}`, {
          description: `${res.newCount} / ${res.target} tampons`,
        });
      }
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              card: {
                ...prev.card,
                stamps_count: res.newCount,
              },
            }
          : null
      );
      if (merchantId) await reload(merchantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'ajout des tampons.");
    } finally {
      setStampsAdding(false);
    }
  }

  async function handleRedeemStampReward() {
    if (!selected || !merchantId) return;
    setRedeemingReward(true);
    try {
      const target = selected.card.stamps_target || 10;
      const res = await redeemStamps({ cardId: selected.card.id, stampsTarget: target });
      toast.success(`Cadeau remis avec succès à ${selected.customer.full_name} !`, {
        description: `La carte a été renouvelée. Tampons restants : ${res.newCount}`,
      });
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              card: {
                ...prev.card,
                stamps_count: res.newCount,
              },
            }
          : null
      );
      if (merchantId) await reload(merchantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la remise de la récompense.");
    } finally {
      setRedeemingReward(false);
    }
  }

  const selectedTheme = themes.find((t) => t.id === themeId) ?? themes[0]!;

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${customers.length} client${customers.length !== 1 ? "s" : ""} au total`}
        actions={
          <Button onClick={() => setNewCardOpen(true)} className="w-full sm:w-auto">
            <Plus className="size-4" /> Nouveau client
          </Button>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="p-3.5 sm:p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom ou numéro (07…)"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="Aucun client trouvé"
              description={
                customers.length === 0
                  ? "Créez votre premier client avec le bouton ci-dessus."
                  : "Aucun client ne correspond à votre recherche."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 sm:px-4">Client</TableHead>
                  <TableHead className="text-right px-3 sm:px-4">Fidélité / Solde</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Activité cumulée</TableHead>
                  <TableHead className="hidden md:table-cell">Inscrit</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                  <TableHead className="text-right px-3 sm:px-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const cardType = c.card.card_type || "points";
                  return (
                    <TableRow
                      key={c.card.id}
                      className="cursor-pointer hover:bg-accent active:bg-accent/80 transition-colors"
                      onClick={() => openSheet(c)}
                    >
                      <TableCell className="px-3 sm:px-4 py-3">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                            {initials(c.customer.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{c.customer.full_name}</p>
                            {c.customer.phone ? (
                              <p className="text-xs text-muted-foreground truncate">{c.customer.phone}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground/60 italic sm:hidden">Sans numéro</p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Colonne Type / Solde */}
                      <TableCell className="text-right font-semibold px-3 sm:px-4 py-3 whitespace-nowrap">
                        {cardType === "vip" ? (
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                                c.card.vip_tier === "gold"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : c.card.vip_tier === "silver"
                                  ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30"
                                  : "bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30"
                              )}
                            >
                              <Crown className="size-3" />
                              VIP {c.card.vip_tier || "bronze"}
                            </span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-0.5">
                              {(c.card.vip_spent ?? 0).toLocaleString()} DA
                            </span>
                          </div>
                        ) : cardType === "stamps" ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              <Ticket className="size-3" />
                              {c.card.stamps_count ?? 0} / {c.card.stamps_target ?? 10}
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">Tampons</span>
                          </div>
                        ) : (
                          <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs sm:text-sm font-bold text-primary">
                            {c.card.points} pts
                          </span>
                        )}
                      </TableCell>

                      {/* Activité cumulée */}
                      <TableCell className="hidden text-right text-muted-foreground sm:table-cell text-xs font-mono">
                        {cardType === "vip"
                          ? `${(c.card.vip_spent ?? 0).toLocaleString()} DA`
                          : cardType === "stamps"
                          ? `${c.card.stamps_count ?? 0} tampon${(c.card.stamps_count ?? 0) > 1 ? "s" : ""}`
                          : `${c.card.total_earned} pts`}
                      </TableCell>

                      <TableCell className="hidden text-muted-foreground md:table-cell text-xs">
                        {c.joinedFormatted}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right px-2.5 sm:px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {cardType === "points" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={resettingPoints || c.card.points === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetCustomerPoints(c);
                              }}
                              className="h-7 px-2 sm:px-2.5 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0"
                              title={c.card.points === 0 ? "Le solde est déjà à 0" : "Remettre les points à zéro"}
                            >
                              <RotateCcw className="size-3 sm:mr-1" />
                              <span className="hidden sm:inline">Mettre à 0</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openSheet(c);
                              }}
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
                            >
                              Détails
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={deletingCard}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCard(c);
                            }}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            title={`Supprimer la carte de ${c.customer.full_name}`}
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

      {/* ========================================================================= */}
      {/* FICHE CLIENT (SHEET DRAWER)                                               */}
      {/* ========================================================================= */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md p-4 sm:p-6">
          {selected && (() => {
            const cardType = selected.card.card_type || "points";
            const cardTheme = themes.find((t) => t.id === selected.card.theme_id) ?? selectedTheme;

            // Calculs VIP
            const vipSpent = Number(selected.card.vip_spent ?? 0);
            const vipTier = selected.card.vip_tier || "bronze";
            const silverThreshold = Number(selected.card.vip_silver_threshold ?? 15000);
            const goldThreshold = Number(selected.card.vip_gold_threshold ?? 30000);

            let nextThreshold = silverThreshold;
            let nextTierName = "Silver";
            if (vipTier === "silver") {
              nextThreshold = goldThreshold;
              nextTierName = "Gold";
            }
            const progressPercent =
              vipTier === "gold"
                ? 100
                : Math.min(100, Math.round((vipSpent / nextThreshold) * 100));

            // Calculs Tampons
            const stampsCount = Number(selected.card.stamps_count ?? 0);
            const stampsTarget = Number(selected.card.stamps_target ?? 10);
            const stampsCompleted = stampsCount >= stampsTarget;

            return (
              <>
                <SheetHeader>
                  <div className="flex items-center gap-2">
                    <SheetTitle>{selected.customer.full_name}</SheetTitle>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border">
                      {cardType === "vip" ? "VIP" : cardType === "stamps" ? "Tampons" : "Points"}
                    </span>
                  </div>
                  <SheetDescription>
                    {selected.customer.phone ? `${selected.customer.phone} · ` : ""}Inscrit le {selected.joinedFormatted}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-4">
                  {/* Carte virtuelle interactive */}
                  <VirtualCard
                    theme={cardTheme}
                    businessName={merchantName}
                    customerName={selected.customer.full_name}
                    cardType={cardType}
                    cardName={selected.card.card_name || undefined}
                    points={selected.card.points}
                    stampsCount={stampsCount}
                    stampsTarget={stampsTarget}
                    stampReward={selected.card.stamp_reward || undefined}
                    vipTier={vipTier}
                    vipSpent={vipSpent}
                    compact
                  />

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* BLOC ÉTAT : VIP                                               */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  {cardType === "vip" && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Crown className="size-4 text-amber-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Niveau {vipTier.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {vipSpent.toLocaleString()} DA
                        </span>
                      </div>

                      {/* Barre de progression vers le palier suivant */}
                      {vipTier !== "gold" ? (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Progression vers {nextTierName}</span>
                            <span>{vipSpent.toLocaleString()} / {nextThreshold.toLocaleString()} DA</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-surface-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground text-right">
                            Encore {Math.max(0, nextThreshold - vipSpent).toLocaleString()} DA pour passer {nextTierName}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                          <Sparkles className="size-3.5" /> Niveau maximal Gold atteint !
                        </p>
                      )}

                      {/* Avantages du niveau si configurés */}
                      {(() => {
                        const raw =
                          vipTier === "gold"
                            ? selected.card.vip_gold_benefits
                            : vipTier === "silver"
                            ? selected.card.vip_silver_benefits
                            : selected.card.vip_bronze_benefits;
                        const list = (raw || "").split("|").map((s) => s.trim()).filter(Boolean);
                        if (list.length === 0) return null;
                        return (
                          <div className="pt-2 border-t border-amber-500/20 text-xs space-y-1.5">
                            <p className="font-semibold text-foreground">Avantages accordés :</p>
                            <div className="space-y-1">
                              {list.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                                  <Sparkles className="size-3 text-amber-500 shrink-0" />
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* BLOC ÉTAT : TAMPONS                                           */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  {cardType === "stamps" && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ticket className="size-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Carte à Tampons
                          </span>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          {stampsCount} / {stampsTarget} tampons
                        </span>
                      </div>

                      {/* Grille visuelle de tampons */}
                      <div className="grid grid-cols-5 gap-2 py-1">
                        {Array.from({ length: stampsTarget }).map((_, idx) => {
                          const isStamped = idx < stampsCount;
                          const isLast = idx === stampsTarget - 1;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                "aspect-square rounded-xl flex flex-col items-center justify-center font-bold text-xs border transition-all",
                                isStamped
                                  ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                                  : isLast
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  : "bg-surface text-muted-foreground border-border"
                              )}
                            >
                              {isStamped ? (
                                <Check className="size-4 stroke-[3]" />
                              ) : isLast ? (
                                <Gift className="size-4" />
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Récompense */}
                      <div className="rounded-lg bg-surface-muted p-2.5 space-y-0.5">
                        <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <Gift className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          {selected.card.stamp_reward || "1 produit offert au 10ème passage"}
                        </p>
                        {selected.card.stamp_conditions && (
                          <p className="text-[10px] text-muted-foreground italic">
                            {selected.card.stamp_conditions}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* BLOC ÉTAT : POINTS                                            */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  {cardType === "points" && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary shrink-0" />
                          Solde de points
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resettingPoints || selected.card.points === 0}
                          onClick={handleResetPoints}
                          className="h-7 px-2.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shadow-sm shrink-0 w-full sm:w-auto"
                          title={selected.card.points === 0 ? "Le solde est déjà à 0" : "Remettre les points à zéro"}
                        >
                          <RotateCcw className={cn("size-3 mr-1.5", resettingPoints && "animate-spin")} />
                          {resettingPoints ? "En cours…" : "Remettre à 0"}
                        </Button>
                      </div>
                      <div className="text-center py-1">
                        <p className="font-display text-4xl sm:text-5xl font-extrabold text-primary">
                          {selected.card.points} <span className="text-base font-semibold text-primary/80">pts</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total cumulé depuis inscription : <strong className="text-foreground">{selected.card.total_earned} pts</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* ACTIONS SPÉCIFIQUES                                           */}
                  {/* ───────────────────────────────────────────────────────────── */}

                  {/* Action VIP : Ajouter un montant d'achat */}
                  {cardType === "vip" && (
                    <form onSubmit={(e) => handleAddVipSpend(e)} className="space-y-2.5 rounded-xl border p-3.5">
                      <Label htmlFor="vip-amount" className="text-xs font-bold">
                        Enregistrer un achat (DA)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="vip-amount"
                          type="number"
                          placeholder="Montant en DA (ex: 2500)"
                          value={vipSpendInput}
                          onChange={(e) => setVipSpendInput(e.target.value)}
                          className="h-9 text-xs font-mono"
                        />
                        <Button type="submit" disabled={addingVipSpend || !vipSpendInput} className="h-9 px-3 text-xs">
                          {addingVipSpend ? "..." : "+ Ajouter"}
                        </Button>
                      </div>

                      {/* Boutons rapides */}
                      <div className="flex gap-1.5 pt-1">
                        {[1000, 3000, 5000, 10000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => handleAddVipSpend(undefined, amt)}
                            disabled={addingVipSpend}
                            className="flex-1 py-1 rounded-md text-[10px] font-mono border bg-surface-muted hover:bg-accent transition-colors"
                          >
                            +{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </form>
                  )}

                  {/* Action Tampons : +1, +2, ou remise récompense */}
                  {cardType === "stamps" && (
                    <div className="space-y-2.5 rounded-xl border p-3.5">
                      {stampsCompleted ? (
                        <div className="space-y-2">
                          <div className="rounded-lg bg-emerald-500/15 p-2.5 text-center text-xs text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/30">
                            🎉 Objectif atteint ! Le client a droit à sa récompense.
                          </div>
                          <Button
                            type="button"
                            onClick={handleRedeemStampReward}
                            disabled={redeemingReward}
                            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md"
                          >
                            <Gift className="size-4 mr-2" />
                            {redeemingReward ? "Validation..." : "Valider la remise du cadeau"}
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <Label className="text-xs font-bold block mb-2">
                            Valider des tampons
                          </Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              onClick={() => handleAddStamps(1)}
                              disabled={stampsAdding}
                              className="h-10 text-xs font-semibold"
                            >
                              <Plus className="size-3.5 mr-1" /> 1 Tampon
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleAddStamps(2)}
                              disabled={stampsAdding}
                              className="h-10 text-xs font-semibold"
                            >
                              <Plus className="size-3.5 mr-1" /> 2 Tampons
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Points : Ajouter des points & Remise à 0 */}
                  {cardType === "points" && (
                    <div className="space-y-3 rounded-xl border p-3.5 bg-surface-muted/30">
                      <form onSubmit={handleAddPoints} className="space-y-2.5">
                        <Label htmlFor="pts" className="text-xs font-bold">
                          Ajouter des points
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="pts"
                            inputMode="numeric"
                            placeholder="ex: 20"
                            value={pointsInput}
                            onChange={(e) => {
                              setPointsInput(e.target.value);
                              setPointsError("");
                            }}
                            className="h-9 text-xs bg-background"
                          />
                          <Button type="submit" disabled={addingPoints || !pointsInput} className="h-9 px-3 text-xs">
                            {addingPoints ? "…" : "+ Ajouter"}
                          </Button>
                        </div>
                        {pointsError && <p className="text-xs text-destructive">{pointsError}</p>}
                      </form>

                      {/* Remettre les points à zéro */}
                      <div className="pt-2.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-left">
                          <p className="text-xs font-semibold text-foreground">Remise à zéro</p>
                          <p className="text-[11px] text-muted-foreground">
                            Remet le solde actuel à 0 pt
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resettingPoints || selected.card.points === 0}
                          onClick={handleResetPoints}
                          className="h-8 px-3 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 w-full sm:w-auto"
                          title={selected.card.points === 0 ? "Le solde est déjà à 0" : "Remettre les points à zéro"}
                        >
                          <RotateCcw className={cn("size-3.5 mr-1.5", resettingPoints && "animate-spin")} />
                          {resettingPoints ? "En cours…" : "Mettre à 0"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* NUMÉRO DE TÉLÉPHONE DU CLIENT                                 */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="rounded-xl border p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <Phone className="size-3.5" />
                        Numéro de téléphone
                      </p>
                      {!editingPhone && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setPhoneInput(selected.customer.phone || "");
                            setEditingPhone(true);
                          }}
                        >
                          <Edit2 className="mr-1 size-3" />
                          {selected.customer.phone ? "Modifier" : "Ajouter"}
                        </Button>
                      )}
                    </div>

                    {editingPhone ? (
                      <div className="space-y-2 pt-1">
                        <Input
                          type="tel"
                          placeholder="07XXXXXXXX"
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className="h-8 text-xs font-mono"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setEditingPhone(false)}
                            disabled={savingPhone}
                          >
                            Annuler
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleSavePhone}
                            disabled={savingPhone}
                          >
                            {savingPhone ? "Enregistrement…" : "Enregistrer"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-medium font-mono">
                        {selected.customer.phone || (
                          <span className="text-xs text-muted-foreground italic font-sans">
                            Aucun numéro enregistré
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* PARTAGE DU LIEN DE LA CARTE                                   */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="rounded-xl border p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Partager la carte
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded-md bg-surface-muted px-2 py-1.5 text-xs font-mono">
                        {buildCardLink(selected.card.qr_token)}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => handleCopyLink(selected.card.qr_token)}
                      >
                        <Copy className="size-4" />
                        {copiedToken === selected.card.qr_token ? "Copié !" : "Copier"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleShareWhatsApp(selected)}
                        className="bg-[#25D366] hover:bg-[#1ebe59] text-white"
                      >
                        <MessageCircle className="size-4" />
                        WhatsApp
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareSMS(selected)}
                      >
                        <Smartphone className="size-4" />
                        SMS
                      </Button>
                    </div>
                    {typeof window !== "undefined" && navigator.share && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={async () => {
                          try {
                            await navigator.share({
                              title: `Carte de fidélité ${merchantName}`,
                              text: `Bonjour ${selected.customer.full_name} , Voici votre carte de fidélité *${merchantName}* :\n Ouvrez ce lien pour voir vos avantages et récompenses`,
                              url: buildCardLink(selected.card.qr_token),
                            });
                          } catch {
                            // annulé
                          }
                        }}
                      >
                        <Share2 className="size-4" />
                        Partager via l'appareil
                      </Button>
                    )}
                  </div>

                  {/* Historique transactions (pour points) */}
                  {cardTx.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Dernières transactions</p>
                      <ul className="space-y-1">
                        {cardTx.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2 text-xs"
                          >
                            <span className="text-muted-foreground">{t.description}</span>
                            <span
                              className={
                                t.points_delta > 0
                                  ? "font-semibold text-success"
                                  : "font-semibold text-destructive"
                              }
                            >
                              {t.points_delta > 0 ? "+" : ""}
                              {t.points_delta}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* ───────────────────────────────────────────────────────────── */}
                  {/* ZONE DANGEREUSE : SUPPRIMER LE CLIENT                         */}
                  {/* ───────────────────────────────────────────────────────────── */}
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <p className="text-xs font-bold text-destructive">Zone dangereuse</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Supprime définitivement ce client et son historique
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingCard}
                        onClick={() => handleDeleteCard(selected)}
                        className="h-8 px-3 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/40 shrink-0 w-full sm:w-auto"
                      >
                        <Trash2 className={cn("size-3.5 mr-1.5", deletingCard && "animate-pulse")} />
                        {deletingCard ? "Suppression…" : "Supprimer"}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={async () => {
          if (merchantId) await reload(merchantId);
        }}
      />
    </div>
  );
}
