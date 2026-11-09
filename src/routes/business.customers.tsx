import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Edit2, MessageCircle, Phone, Plus, Search, Share2, Smartphone, Users } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getMerchantCustomers, type CustomerWithCard } from "@/lib/db/customers";
import { addPoints } from "@/lib/db/cards";
import { getCardTransactions } from "@/lib/db/transactions";
import type { Transaction } from "@/lib/db/transactions";
import { getLoyaltyProgram } from "@/lib/db/program";
import { getMyMerchant } from "@/lib/db/merchants";

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

const filters = [
  { id: "all", label: "Tous" },
  { id: "active", label: "Actifs" },
  { id: "inactive", label: "Inactifs" },
  { id: "new", label: "Nouveaux" },
] as const;

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
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CustomerWithCard | null>(null);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
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
      `Bonjour ${c.customer.full_name} 👋\n\nVoici votre carte de fidélité *${merchantName}* :\n${link}\n\nOuvrez ce lien pour voir vos points 🎁`
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
      `Bonjour ${c.customer.full_name}, voici votre carte de fidélité ${merchantName} : ${link}`
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
    const hasQuery = query.trim().length > 0;
    return customers.filter((c) => {
      // Si une recherche est en cours, chercher dans TOUS les clients (ne pas bloquer par le statut)
      const matchFilter = hasQuery || filter === "all" || c.status === filter;
      return matchFilter && matchesCustomer(c, query);
    });
  }, [customers, query, filter]);

  async function openSheet(c: CustomerWithCard) {
    setSelected(c);
    setPointsInput("");
    setPointsError("");
    setEditingPhone(false);
    setPhoneInput(c.customer.phone || "");
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
        <div className="flex flex-col gap-3 p-3.5 sm:p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou numéro (07…)" className="pl-9" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v)} className="w-full sm:w-auto">
            <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
              {filters.map((f) => (
                <TabsTrigger key={f.id} value={f.id} className="text-xs sm:text-sm px-2 sm:px-3">
                  {f.label}
                </TabsTrigger>
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
                  <TableHead className="px-3 sm:px-4">Client</TableHead>
                  <TableHead className="text-right px-3 sm:px-4">Points</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Total gagné</TableHead>
                  <TableHead className="hidden md:table-cell">Inscrit</TableHead>
                  <TableHead className="hidden sm:table-cell">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.card.id} className="cursor-pointer hover:bg-accent active:bg-accent/80 transition-colors"
                    onClick={() => openSheet(c)}>
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
                    <TableCell className="text-right font-semibold px-3 sm:px-4 py-3 whitespace-nowrap">
                      <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs sm:text-sm font-bold text-primary">
                        {c.card.points} pts
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                      {c.card.total_earned}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.joinedFormatted}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Fiche client */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md p-4 sm:p-6">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.customer.full_name}</SheetTitle>
                <SheetDescription>
                  {selected.customer.phone ? `${selected.customer.phone} · ` : ""}Inscrit le {selected.joinedFormatted}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Carte virtuelle */}
                <VirtualCard
                  theme={selectedTheme}
                  businessName={merchantName}
                  points={selected.card.points}
                  compact
                />

                {/* Solde */}
                <div className="rounded-xl bg-surface-muted p-5 text-center space-y-1">
                  <p className="font-display text-4xl font-bold text-primary">
                    {selected.card.points} pts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total cumulé : {selected.card.total_earned} pts
                  </p>
                </div>

                {/* Numéro de téléphone du client */}
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

                {/* Partage du lien de la carte */}
                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-semibold">Partager la carte</p>
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
                            text: `Bonjour ${selected.customer.full_name}, voici votre carte de fidélité !`,
                            url: buildCardLink(selected.card.qr_token),
                          });
                        } catch { /* annulé */ }
                      }}
                    >
                      <Share2 className="size-4" />
                      Partager via l'appareil
                    </Button>
                  )}
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
    </div>
  );
}
