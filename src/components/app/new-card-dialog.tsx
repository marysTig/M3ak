/**
 * new-card-dialog.tsx — Multi-type Loyalty Card Creation Flow
 *
 * STEP 1: Sélection du type de fidélité (VIP, POINTS, TAMPONS)
 * STEP 2: Configuration spécifique selon le type choisi
 * STEP 3: Aperçu avant validation et confirmation
 * STEP 4: Partage du lien unique (WhatsApp, SMS, Copie)
 */
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Crown,
  Gift,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Share2,
  Smartphone,
  Sparkles,
  Ticket,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { getLoyaltyProgram } from "@/lib/db/program";
import type { CardType } from "@/lib/db/cards";
import { cn } from "@/lib/utils";

interface NewCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "type_selection" | "configure" | "preview" | "created";

interface CreatedData {
  customerName: string;
  cardId: string;
  qrToken: string;
  cardType: CardType;
  cardName?: string;
  points: number;
  stampsCount: number;
  stampsTarget: number;
  stampReward?: string;
  vipTier: "bronze" | "silver" | "gold";
  vipSpent: number;
  themeId: string;
  cardLink: string;
  phone?: string;
}

/** Génère le lien public de la carte */
function buildCardLink(qrToken: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://m3ak.vercel.app";
  return `${base}/card/${qrToken}`;
}

/** Formate le numéro local saisi (commence directement par 07, 05 ou 06, sans +213 ni 213) */
function normalizeLocalPhone(value: string): string {
  const v = value.trim().replace(/\s+/g, "");
  if (v.startsWith("+2130")) return "0" + v.slice(5);
  if (v.startsWith("+213")) return "0" + v.slice(4);
  if (v.startsWith("2130")) return "0" + v.slice(4);
  if (v.startsWith("213") && v.length >= 11) return "0" + v.slice(3);
  return value;
}

/** Formate le numéro pour l'API WhatsApp (wa.me) : doit être 2137XXXXXXXX (SANS 0 entre 213 et 7) */
function formatWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("2130")) return "213" + digits.slice(4);
  if (digits.startsWith("0")) return "213" + digits.slice(1);
  if (!digits.startsWith("213") && digits.length === 9) return "213" + digits;
  return digits;
}

/** Formate le numéro pour l'application SMS */
function formatSMSPhone(raw: string): string {
  return normalizeLocalPhone(raw);
}

// ─── Composant éditeur d'avantages par niveau VIP ─────────────────────────────
interface VipTierEditorProps {
  emoji: string;
  label: string;
  sublabel: string;
  labelColor: string;
  threshold: string;
  onThresholdChange: (v: string) => void;
  benefits: string[];
  onBenefitsChange: (v: string[]) => void;
}

function VipTierEditor({
  emoji, label, sublabel, labelColor,
  threshold, onThresholdChange,
  benefits, onBenefitsChange,
}: VipTierEditorProps) {
  function addBenefit() {
    onBenefitsChange([...benefits, ""]);
  }
  function updateBenefit(index: number, value: string) {
    const updated = [...benefits];
    updated[index] = value;
    onBenefitsChange(updated);
  }
  function removeBenefit(index: number) {
    onBenefitsChange(benefits.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-lg border bg-background p-2.5 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-bold", labelColor)}>{emoji} {label}</span>
        <span className="text-[10px] text-muted-foreground">{sublabel}</span>
      </div>

      {/* Seuil */}
      <div>
        <Label className="text-[10px] text-muted-foreground">Seuil d'accès (DA)</Label>
        <Input
          type="number"
          value={threshold}
          onChange={(e) => onThresholdChange(e.target.value)}
          className="h-8 text-xs font-mono mt-1"
        />
      </div>

      {/* Liste des avantages */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Avantages inclus</Label>
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] w-4 shrink-0 text-center">•</span>
            <Input
              value={benefit}
              placeholder={`Avantage ${index + 1}`}
              onChange={(e) => updateBenefit(index, e.target.value)}
              className="h-8 text-xs flex-1"
            />
            {benefits.length > 1 && (
              <button
                type="button"
                onClick={() => removeBenefit(index)}
                className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addBenefit}
          className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors mt-1"
        >
          <Plus className="size-3.5" />
          Ajouter un avantage
        </button>
      </div>
    </div>
  );
}

export function NewCardDialog({ open, onOpenChange, onCreated }: NewCardDialogProps) {
  const [step, setStep] = useState<Step>("type_selection");
  const [cardType, setCardType] = useState<CardType>("vip");

  // Données communes
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");

  // Configuration VIP
  const [vipCardName, setVipCardName] = useState("Club VIP");
  const [bronzeThreshold, setBronzeThreshold] = useState("0");
  const [bronzeBenefits, setBronzeBenefits] = useState<string[]>(["-5% de réduction"]);
  const [silverThreshold, setSilverThreshold] = useState("15000");
  const [silverBenefits, setSilverBenefits] = useState<string[]>(["-10% de réduction", "Cadeau de bienvenue"]);
  const [goldThreshold, setGoldThreshold] = useState("30000");
  const [goldBenefits, setGoldBenefits] = useState<string[]>(["-15% de réduction", "Accès prioritaire", "Cadeau exclusif"]);

  // Accordéon aperçu VIP
  const [openTier, setOpenTier] = useState<"bronze" | "silver" | "gold" | null>(null);

  // Configuration POINTS
  const [initialPoints, setInitialPoints] = useState("0");

  // Configuration TAMPONS (STAMPS)
  const [stampCardName, setStampCardName] = useState("Carte à Tampons");
  const [stampsTarget, setStampsTarget] = useState(10);
  const [stampReward, setStampReward] = useState("1 produit offert au 10ème passage");
  const [stampConditions, setStampConditions] = useState("");

  // Thème & Merchant
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("Mon commerce");
  const [themeId, setThemeId] = useState("aurora");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase
        .from("merchants")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (m) {
        setMerchantId(m.id);
        setMerchantName(m.name);
        const prog = await getLoyaltyProgram(m.id);
        if (prog?.theme_id) setThemeId(prog.theme_id);
      }
    });
  }, [open]);

  function reset() {
    setStep("type_selection");
    setCardType("vip");
    setCustomerName("");
    setPhone("");
    setNameError("");
    setVipCardName("Club VIP");
    setBronzeThreshold("0");
    setBronzeBenefits(["-5% de réduction"]);
    setSilverThreshold("15000");
    setSilverBenefits(["-10% de réduction", "Cadeau de bienvenue"]);
    setGoldThreshold("30000");
    setGoldBenefits(["-15% de réduction", "Accès prioritaire", "Cadeau exclusif"]);
    setOpenTier(null);
    setInitialPoints("0");
    setStampCardName("Carte à Tampons");
    setStampsTarget(10);
    setStampReward("1 produit offert au 10ème passage");
    setStampConditions("");
    setCreated(null);
    setLoading(false);
    setCopied(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function validateConfigure() {
    if (!customerName.trim()) {
      setNameError("Le nom du client est requis.");
      return false;
    }
    setNameError("");
    return true;
  }

  function handleSelectType(type: CardType) {
    setCardType(type);
    setStep("configure");
  }

  function handleProceedToPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!validateConfigure()) return;
    setStep("preview");
  }

  async function handleConfirmCreate() {
    if (!merchantId) return;
    setLoading(true);

    try {
      const configPayload = {
        initial_points: Number(initialPoints) || 0,
        stamps_target: Number(stampsTarget) || 10,
        stamp_reward: stampReward.trim() || "1 produit offert au 10ème passage",
        stamp_conditions: stampConditions.trim() || null,
        bronze_threshold: Number(bronzeThreshold) || 0,
        silver_threshold: Number(silverThreshold) || 15000,
        gold_threshold: Number(goldThreshold) || 30000,
        bronze_benefits: bronzeBenefits.filter(Boolean).join(" | ") || "-5% de réduction",
        silver_benefits: silverBenefits.filter(Boolean).join(" | ") || "-10% de réduction",
        gold_benefits: goldBenefits.filter(Boolean).join(" | ") || "-15% de réduction",
      };

      const resolvedCardName =
        cardType === "vip"
          ? vipCardName.trim() || "Club VIP"
          : cardType === "stamps"
          ? stampCardName.trim() || "Carte à Tampons"
          : null;

      // 1. Tenter l'appel avec les 7 paramètres (nouvelle RPC)
      let cardResult: { card_id: string; qr_token: string; points: number; customer_name: string } | null = null;

      try {
        const { data, error } = await supabase.rpc("merchant_create_card", {
          p_customer_name: customerName.trim(),
          p_merchant_id: merchantId,
          p_phone: phone.trim() || null,
          p_card_type: cardType,
          p_card_name: resolvedCardName,
          p_theme_id: themeId,
          p_config: configPayload,
        });

        if (!error && data) {
          cardResult = data as typeof cardResult;
        } else if (error && !error.message?.includes("function") && error.code !== "PGRST202") {
          throw new Error(error.message);
        }
      } catch (rpcErr) {
        // En cas d'erreur de signature, passer au fallback ci-dessous
      }

      // 2. Fallback sécurisé : si la RPC avec 7 paramètres n'est pas encore rechargée, appeler avec 3 paramètres puis mettre à jour la ligne
      if (!cardResult) {
        const { data: legacyData, error: legacyErr } = await supabase.rpc("merchant_create_card", {
          p_customer_name: customerName.trim(),
          p_merchant_id: merchantId,
          p_phone: phone.trim() || null,
        });

        if (legacyErr || !legacyData) {
          throw new Error(legacyErr?.message || "Erreur lors de la création de la carte.");
        }
        cardResult = legacyData as typeof cardResult;

        // Mettre à jour directement les colonnes de type et configuration
        await supabase
          .from("loyalty_cards")
          .update({
            card_type: cardType,
            card_name: resolvedCardName,
            theme_id: themeId,
            points: Number(initialPoints) || 0,
            stamps_count: 0,
            stamps_target: Number(stampsTarget) || 10,
            stamp_reward: configPayload.stamp_reward,
            stamp_conditions: configPayload.stamp_conditions,
            vip_tier: "bronze",
            vip_spent: 0,
            vip_bronze_threshold: configPayload.bronze_threshold,
            vip_silver_threshold: configPayload.silver_threshold,
            vip_gold_threshold: configPayload.gold_threshold,
            vip_bronze_benefits: configPayload.bronze_benefits,
            vip_silver_benefits: configPayload.silver_benefits,
            vip_gold_benefits: configPayload.gold_benefits,          })
          .eq("id", cardResult.card_id);
      }

      const cardLink = buildCardLink(cardResult.qr_token);

      setCreated({
        customerName: customerName.trim(),
        cardId: cardResult.card_id,
        qrToken: cardResult.qr_token,
        cardType,
        cardName: resolvedCardName || undefined,
        points: Number(initialPoints) || 0,
        stampsCount: 0,
        stampsTarget: Number(stampsTarget) || 10,
        stampReward: configPayload.stamp_reward,
        vipTier: "bronze",
        vipSpent: 0,
        themeId,
        cardLink,
        phone: phone.trim() || undefined,
      });

      setStep("created");
      onCreated?.();
      toast.success(`Carte créée avec succès pour ${customerName.trim()} !`, {
        description: "Partagez maintenant le lien via WhatsApp ou SMS.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.cardLink);
      setCopied(true);
      toast.success("Lien copié dans le presse-papier !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  function handleShareWhatsApp() {
    if (!created) return;
    const waPhone = formatWhatsAppPhone(phone);
    const msg = encodeURIComponent(
      `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* : ${created.cardLink}\n Ouvrez ce lien pour voir vos avantages et récompenses`
    );
    const url = waPhone ? `https://wa.me/${waPhone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleShareSMS() {
    if (!created) return;
    const smsPhone = formatSMSPhone(phone);
    const body = encodeURIComponent(
      `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* : ${created.cardLink}\n Ouvrez ce lien pour voir vos avantages et récompenses`
    );
    const url = smsPhone ? `sms:${smsPhone}?body=${body}` : `sms:?body=${body}`;
    window.open(url, "_self");
  }

  async function handleNativeShare() {
    if (!created || !navigator.share) return;
    try {
      await navigator.share({
        title: `Carte de fidélité ${merchantName}`,
        text: `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* :\n Ouvrez ce lien pour voir vos avantages et récompenses`,
        url: created.cardLink,
      });
    } catch {
      // annulé
    }
  }

  const selectedTheme = themes.find((t) => t.id === themeId) ?? themes[0]!;
  const hasNativeShare = typeof window !== "undefined" && !!navigator.share;

  const resolvedPreviewCardName =
    cardType === "vip" ? vipCardName : cardType === "stamps" ? stampCardName : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.25rem)] sm:max-w-xl max-h-[92dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        {/* ========================================================================= */}
        {/* ÉTAPE 1 : SÉLECTION DU TYPE DE FIDÉLITÉ                                   */}
        {/* ========================================================================= */}
        {step === "type_selection" && (
          <div className="space-y-4 sm:space-y-5">
            <DialogHeader className="text-center sm:text-left space-y-1">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary">
                Étape 1 sur 3
              </span>
              <DialogTitle className="text-lg sm:text-xl font-bold">
                Choisir le type de carte
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Sélectionnez le modèle de fidélité adapté à votre commerce et à vos clients.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3 sm:gap-3.5 pt-1">
              {/* CARTE 1 : VIP */}
              <button
                type="button"
                onClick={() => handleSelectType("vip")}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-4 rounded-2xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent text-left transition-all hover:border-amber-500 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <Crown className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Carte VIP
                    </h3>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Prestige
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    Niveaux de fidélité basés sur le montant cumulé des achats.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🥉 Bronze
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🥈 Silver
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🥇 Gold
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold self-center ml-1">
                      Seuils & avantages configurables
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden sm:block size-5 text-muted-foreground/40 group-hover:text-amber-500 group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* CARTE 2 : POINTS */}
              <button
                type="button"
                onClick={() => handleSelectType("points")}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-4 rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent text-left transition-all hover:border-primary hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
                  <Coins className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Carte à Points
                    </h3>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Classique M3ak
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    Le système historique M3ak : cumulez des points et échangez-les contre des cadeaux.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      ⭐ Points par passage
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🎁 Catalogue de récompenses
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      100% compatible
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden sm:block size-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* CARTE 3 : TAMPONS */}
              <button
                type="button"
                onClick={() => handleSelectType("stamps")}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-4 rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent text-left transition-all hover:border-emerald-500 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <Ticket className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Carte à Tampons
                    </h3>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Simple & Visuel
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    1 tampon par achat validé. Un produit ou avantage offert au dernier passage.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🎟️ Objectif configurable (ex: 10)
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      🎉 Récompense finale
                    </span>
                    <span className="inline-flex items-center rounded-md bg-surface-muted px-1.5 py-0.5 font-medium">
                      Idéal café, fast-food, coiffure
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden sm:block size-5 text-muted-foreground/40 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-xl text-xs sm:text-sm"
                onClick={() => handleOpenChange(false)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAPE 2 : CONFIGURATION SPÉCIFIQUE                                        */}
        {/* ========================================================================= */}
        {step === "configure" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b">
              <button
                type="button"
                onClick={() => setStep("type_selection")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Changer de type
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Étape 2 sur 3
              </span>
            </div>

            <DialogHeader className="text-center sm:text-left space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-bold">
                  Configuration :{" "}
                  {cardType === "vip"
                    ? "Carte VIP"
                    : cardType === "stamps"
                    ? "Carte à Tampons"
                    : "Carte à Points"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                Renseignez les détails du client et personnalisez les paramètres de la carte.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleProceedToPreview} className="space-y-4 pt-1">
              {/* Informations client (communes) */}
              <div className="rounded-xl border bg-surface-muted/50 p-3 sm:p-3.5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Informations client
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="customer-name" className="text-xs sm:text-sm">
                    Nom complet du client <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customer-name"
                    placeholder="Ahmed Belkacem"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoComplete="off"
                    className="h-10 text-sm bg-background"
                  />
                  {nameError && <p className="text-xs text-destructive">{nameError}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="customer-phone" className="text-xs sm:text-sm">
                    Numéro de téléphone <span className="text-muted-foreground font-normal">(optionnel)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="customer-phone"
                      type="tel"
                      placeholder="07XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(normalizeLocalPhone(e.target.value))}
                      autoComplete="off"
                      className="pl-9 h-10 text-sm font-mono bg-background"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Format : 07XXXXXXXX, 05XXXXXXXX, 06XXXXXXXX
                  </p>
                </div>
              </div>

              {/* Configuration VIP */}
              {cardType === "vip" && (
                <div className="space-y-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <div className="flex items-center gap-2">
                    <Crown className="size-4 text-amber-500" />
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Paliers & Avantages VIP
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="vip-card-name" className="text-xs">
                      Nom du programme VIP
                    </Label>
                    <Input
                      id="vip-card-name"
                      placeholder="Club VIP"
                      value={vipCardName}
                      onChange={(e) => setVipCardName(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                  </div>

                  {/* Bronze */}
                  <VipTierEditor
                    emoji="🥉"
                    label="Niveau Bronze"
                    sublabel="Niveau de départ"
                    labelColor="text-amber-700 dark:text-amber-400"
                    threshold={bronzeThreshold}
                    onThresholdChange={setBronzeThreshold}
                    benefits={bronzeBenefits}
                    onBenefitsChange={setBronzeBenefits}
                  />

                  {/* Silver */}
                  <VipTierEditor
                    emoji="🥈"
                    label="Niveau Silver"
                    sublabel="Client régulier"
                    labelColor="text-slate-700 dark:text-slate-300"
                    threshold={silverThreshold}
                    onThresholdChange={setSilverThreshold}
                    benefits={silverBenefits}
                    onBenefitsChange={setSilverBenefits}
                  />

                  {/* Gold */}
                  <VipTierEditor
                    emoji="🥇"
                    label="Niveau Gold"
                    sublabel="Meilleur client"
                    labelColor="text-yellow-600 dark:text-yellow-400"
                    threshold={goldThreshold}
                    onThresholdChange={setGoldThreshold}
                    benefits={goldBenefits}
                    onBenefitsChange={setGoldBenefits}
                  />
                </div>
              )}

              {/* Configuration POINTS */}
              {cardType === "points" && (
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <div className="flex items-center gap-2">
                    <Coins className="size-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Paramètres des points
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="initial-points" className="text-xs">
                      Points de bienvenue offerts
                    </Label>
                    <Input
                      id="initial-points"
                      type="number"
                      placeholder="0"
                      value={initialPoints}
                      onChange={(e) => setInitialPoints(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Solde initial crédité dès la création (ex: 20 points de bienvenue).
                    </p>
                  </div>
                </div>
              )}

              {/* Configuration TAMPONS */}
              {cardType === "stamps" && (
                <div className="space-y-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                  <div className="flex items-center gap-2">
                    <Ticket className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Paramètres des tampons
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stamp-card-name" className="text-xs">
                      Nom de la carte à tampons
                    </Label>
                    <Input
                      id="stamp-card-name"
                      placeholder="Carte Café & Délices"
                      value={stampCardName}
                      onChange={(e) => setStampCardName(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Nombre de tampons requis pour le cadeau</Label>
                    <div className="flex items-center gap-2">
                      {[6, 8, 10, 12].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setStampsTarget(num)}
                          className={cn(
                            "flex-1 h-9 rounded-lg text-xs font-bold border transition-all",
                            stampsTarget === num
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-background text-foreground border-border hover:bg-surface-muted"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={2}
                        max={50}
                        value={stampsTarget}
                        onChange={(e) => setStampsTarget(Number(e.target.value) || 10)}
                        className="w-16 h-9 text-xs font-mono text-center bg-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stamp-reward" className="text-xs">
                      Récompense offerte au dernier passage <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="stamp-reward"
                      placeholder="1 produit offert au 10ème passage"
                      value={stampReward}
                      onChange={(e) => setStampReward(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="stamp-conditions" className="text-xs">
                      Conditions particulières <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </Label>
                    <Input
                      id="stamp-conditions"
                      placeholder="Ex: Valable 6 mois, hors promotions"
                      value={stampConditions}
                      onChange={(e) => setStampConditions(e.target.value)}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Personnalisation visuelle (Thème) */}
              <div className="space-y-2 rounded-xl border p-3">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Thème visuel de la carte
                </Label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {themes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setThemeId(t.id)}
                      className={cn(
                        "h-8 rounded-lg border-2 transition-all relative overflow-hidden flex items-center justify-center",
                        themeId === t.id
                          ? "border-primary ring-2 ring-primary/40 scale-105"
                          : "border-transparent opacity-80 hover:opacity-100"
                      )}
                      style={{ background: t.mesh }}
                      title={t.label}
                    >
                      {themeId === t.id && (
                        <Check className="size-3.5 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm"
                  onClick={() => setStep("type_selection")}
                >
                  <ArrowLeft className="size-4 mr-1.5" />
                  Précédent
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-semibold"
                >
                  Continuer vers l'aperçu
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAPE 3 : APERÇU DE LA CARTE AVANT VALIDATION                             */}
        {/* ========================================================================= */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1 border-b">
              <button
                type="button"
                onClick={() => setStep("configure")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Modifier les paramètres
              </button>
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                Étape 3 sur 3
              </span>
            </div>

            <DialogHeader className="text-center sm:text-left space-y-1">
              <DialogTitle className="text-base sm:text-lg font-bold">
                Aperçu et confirmation
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Vérifiez la carte avant d'enregistrer. Le client pourra la consulter immédiatement via son lien unique.
              </DialogDescription>
            </DialogHeader>

            {/* Rendu dynamique de la carte */}
            <div className="flex flex-col items-center py-1">
              <div className="w-full max-w-[340px]">
                <VirtualCard
                  theme={selectedTheme}
                  businessName={merchantName}
                  customerName={customerName}
                  cardType={cardType}
                  cardName={resolvedPreviewCardName}
                  points={Number(initialPoints) || 0}
                  stampsCount={0}
                  stampsTarget={Number(stampsTarget) || 10}
                  stampReward={stampReward}
                  vipTier="bronze"
                  vipSpent={0}
                  compact={false}
                />
              </div>
            </div>

            {/* Résumé de configuration */}
            <div className="rounded-xl border bg-surface-muted p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-muted-foreground">Type de carte :</span>
                <span className="font-bold uppercase text-foreground">
                  {cardType === "vip"
                    ? "Carte VIP (3 Paliers)"
                    : cardType === "stamps"
                    ? `Carte à Tampons (${stampsTarget} passages)`
                    : "Carte à Points"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Client :</span>
                <span className="font-semibold text-foreground">{customerName}</span>
              </div>
              {phone && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Téléphone :</span>
                  <span className="font-mono text-foreground">{phone}</span>
                </div>
              )}

              {cardType === "vip" && (
                <div className="pt-2 border-t space-y-2">
                  <p className="font-semibold text-foreground text-[11px]">Avantages par niveau :</p>
                  {[
                    { emoji: "🥉", label: "Bronze", threshold: bronzeThreshold, benefits: bronzeBenefits, tier: "bronze" as const, color: "text-amber-700 dark:text-amber-400" },
                    { emoji: "🥈", label: "Silver", threshold: silverThreshold, benefits: silverBenefits, tier: "silver" as const, color: "text-slate-600 dark:text-slate-300" },
                    { emoji: "🥇", label: "Gold", threshold: goldThreshold, benefits: goldBenefits, tier: "gold" as const, color: "text-yellow-600 dark:text-yellow-400" },
                  ].map(({ emoji, label, threshold, benefits, tier, color }) => (
                    <div key={tier} className="rounded-lg border bg-background overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenTier(openTier === tier ? null : tier)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-muted/50 transition-colors"
                      >
                        <span className={cn("text-[11px] font-bold", color)}>
                          {emoji} {label}
                          <span className="font-normal text-muted-foreground ml-1.5">
                            dès {Number(threshold).toLocaleString()} DA
                          </span>
                        </span>
                        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", openTier === tier && "rotate-180")} />
                      </button>
                      {openTier === tier && (
                        <div className="px-3 pb-2.5 space-y-1">
                          {benefits.filter(Boolean).map((b, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                              <Check className="size-3 mt-0.5 text-primary shrink-0" />
                              <span>{b}</span>
                            </div>
                          ))}
                          {benefits.filter(Boolean).length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">Aucun avantage configuré</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {cardType === "stamps" && (
                <div className="pt-2 border-t space-y-1 text-[11px]">
                  <p className="font-semibold text-foreground">Cadeau final :</p>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                    🎁 {stampReward} (après {stampsTarget} tampons)
                  </p>
                  {stampConditions && (
                    <p className="text-muted-foreground italic">Conditions : {stampConditions}</p>
                  )}
                </div>
              )}

              {cardType === "points" && (
                <div className="pt-2 border-t space-y-1 text-[11px]">
                  <p className="text-muted-foreground">
                    Points initiaux : <strong className="text-foreground">{initialPoints} pts</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Boutons de confirmation */}
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm"
                onClick={() => setStep("configure")}
                disabled={loading}
              >
                Modifier
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-semibold bg-primary"
                onClick={handleConfirmCreate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4 mr-1.5" />
                    Confirmer et créer
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÉTAPE 4 : CARTE CRÉÉE & PARTAGE DU LIEN                                   */}
        {/* ========================================================================= */}
        {step === "created" && created && (
          <div className="space-y-4 pt-1">
            <DialogHeader className="text-center sm:text-left space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
                <Check className="size-4" /> Carte créée avec succès !
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Partagez la carte de {created.customerName}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Envoyez le lien au client par WhatsApp ou SMS. Il pourra ouvrir sa carte sans télécharger d'application.
              </DialogDescription>
            </DialogHeader>

            {/* Aperçu carte */}
            <div className="flex flex-col items-center py-1">
              <div className="w-full max-w-[320px]">
                <VirtualCard
                  theme={selectedTheme}
                  businessName={merchantName}
                  customerName={created.customerName}
                  cardType={created.cardType}
                  cardName={created.cardName}
                  points={created.points}
                  stampsCount={created.stampsCount}
                  stampsTarget={created.stampsTarget}
                  stampReward={created.stampReward}
                  vipTier={created.vipTier}
                  vipSpent={created.vipSpent}
                  compact
                />
              </div>
            </div>

            {/* Bloc lien unique */}
            <div className="rounded-xl border bg-surface-muted p-2.5 sm:p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Lien unique de la carte</span>
                {created.phone ? (
                  <span className="font-mono text-foreground font-semibold text-[11px]">
                    {created.phone}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <code className="flex-1 truncate rounded-lg bg-background px-2.5 py-1.5 text-xs font-mono select-all">
                  {created.cardLink}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 h-8 px-2.5 text-xs rounded-lg"
                >
                  {copied ? <Check className="size-3.5 mr-1 text-success" /> : <Copy className="size-3.5 mr-1" />}
                  {copied ? "Copié !" : "Copier"}
                </Button>
              </div>
            </div>

            {/* Boutons de partage rapides */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              <Button
                type="button"
                onClick={handleShareWhatsApp}
                className="h-11 rounded-xl bg-[#25D366] hover:bg-[#1ebe59] text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition-all"
              >
                <MessageCircle className="size-4 mr-1.5 shrink-0" />
                WhatsApp
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleShareSMS}
                className="h-11 rounded-xl font-semibold text-xs sm:text-sm active:scale-95 transition-all"
              >
                <Smartphone className="size-4 mr-1.5 shrink-0" />
                SMS
              </Button>
            </div>

            {hasNativeShare && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-10 rounded-xl text-xs sm:text-sm active:scale-95 transition-all"
                onClick={handleNativeShare}
              >
                <Share2 className="size-4 mr-1.5 shrink-0" />
                Partager via l'appareil
              </Button>
            )}

            <Button
              className="w-full h-11 rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition-all"
              onClick={() => handleOpenChange(false)}
            >
              Terminer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
