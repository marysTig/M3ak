/**
 * card.$token.tsx — Vue publique de la carte de fidélité
 *
 * Accessible sans compte. Supporte les 3 types de cartes :
 * 1. CARTE VIP (Paliers Bronze, Silver, Gold et montant d'achats en DA)
 * 2. CARTE À POINTS (Solde de points et récompenses débloquées)
 * 3. CARTE À TAMPONS (Grille de tampons interactive et cadeau débloqué)
 *
 * URL : /card/{qr_token}
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  Gift,
  Loader2,
  RotateCcw,
  Share2,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { type CardType, type VipTier, resetCardPoints } from "@/lib/db/cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/card/$token")({
  head: () => ({
    meta: [
      { title: "Ma Carte de Fidélité — M3ak" },
      { name: "description", content: "Votre carte de fidélité personnelle." },
      { property: "og:title", content: "Ma Carte de Fidélité — M3ak" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicCardPage,
});

interface CardInfo {
  id: string;
  qr_token: string;
  card_type: CardType;
  card_name: string | null;
  points: number;
  total_earned: number;
  status: string;
  customer_name: string;
  merchant_name: string;
  merchant_category: string | null;
  merchant_logo: string | null;
  theme_id: string;

  // Tampons
  stamps_count: number;
  stamps_target: number;
  stamp_reward: string;
  stamp_conditions: string | null;

  // VIP
  vip_tier: VipTier;
  vip_spent: number;
  vip_bronze_threshold: number;
  vip_silver_threshold: number;
  vip_gold_threshold: number;
  vip_bronze_benefits: string;
  vip_silver_benefits: string;
  vip_gold_benefits: string;

  rewards: { id: string; name: string; points_cost: number; active: boolean }[];
}

function PublicCardPage() {
  const { token } = Route.useParams();
  const [card, setCard] = useState<CardInfo | null>(null);
  const [step, setStep] = useState<"loading" | "found" | "error">("loading");
  const [copied, setCopied] = useState(false);
  const [isMerchant, setIsMerchant] = useState(false);
  const [resettingPoints, setResettingPoints] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("loyalty_cards")
          .select(`
            *,
            profiles!loyalty_cards_customer_id_fkey (full_name),
            merchants!loyalty_cards_merchant_id_fkey (
              id, owner_id, name, category, logo_url,
              loyalty_programs (theme_id),
              rewards (id, name, points_cost, active)
            )
          `)
          .eq("qr_token", token)
          .maybeSingle();

        if (error || !data) {
          setStep("error");
          return;
        }

        const merchant = Array.isArray(data.merchants) ? data.merchants[0] : data.merchants;
        const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
        const program = Array.isArray(merchant?.loyalty_programs)
          ? merchant?.loyalty_programs[0]
          : merchant?.loyalty_programs;
        const rewards = Array.isArray(merchant?.rewards) ? merchant.rewards : [];

        const { data: authData } = await supabase.auth.getSession();
        if (authData.session?.user && merchant?.owner_id === authData.session.user.id) {
          setIsMerchant(true);
        }

        setCard({
          id: data.id,
          qr_token: data.qr_token,
          card_type: (data.card_type as CardType) || "points",
          card_name: data.card_name || null,
          points: data.points ?? 0,
          total_earned: data.total_earned ?? 0,
          status: data.status,
          customer_name: profile?.full_name ?? "Client",
          merchant_name: merchant?.name ?? "Commerce",
          merchant_category: merchant?.category ?? null,
          merchant_logo: merchant?.logo_url ?? null,
          theme_id: data.theme_id || program?.theme_id || "aurora",

          // Tampons
          stamps_count: data.stamps_count ?? 0,
          stamps_target: data.stamps_target ?? 10,
          stamp_reward: data.stamp_reward ?? "1 produit offert au 10ème passage",
          stamp_conditions: data.stamp_conditions || null,

          // VIP
          vip_tier: (data.vip_tier as VipTier) || "bronze",
          vip_spent: Number(data.vip_spent ?? 0),
          vip_bronze_threshold: Number(data.vip_bronze_threshold ?? 0),
          vip_silver_threshold: Number(data.vip_silver_threshold ?? 15000),
          vip_gold_threshold: Number(data.vip_gold_threshold ?? 30000),
          vip_bronze_benefits: data.vip_bronze_benefits ?? "-5% de réduction",
          vip_silver_benefits: data.vip_silver_benefits ?? "-10% de réduction + Cadeau",
          vip_gold_benefits: data.vip_gold_benefits ?? "-15% de réduction + Accès prioritaire",

          rewards: (rewards as CardInfo["rewards"]).filter((r) => r.active),
        });
        setStep("found");
      } catch {
        setStep("error");
      }
    }
    load();
  }, [token]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Lien de votre carte copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  async function handleShare() {
    if (typeof window !== "undefined" && navigator.share && card) {
      try {
        await navigator.share({
          title: `Ma carte de fidélité ${card.merchant_name}`,
          text: `Voici ma carte de fidélité ${card.merchant_name} !`,
          url: window.location.href,
        });
      } catch {
        // Annulé
      }
    } else {
      handleCopy();
    }
  }

  async function handleResetPoints() {
    if (!card) return;
    if (card.points === 0) {
      toast.info("Le solde est déjà à 0 point.");
      return;
    }
    const confirmed = window.confirm(
      `Confirmez-vous la remise à zéro des points de ${card.customer_name} (${card.points} pts actuellement) ?`
    );
    if (!confirmed) return;

    setResettingPoints(true);
    try {
      await resetCardPoints(card.id);
      setCard((prev) => (prev ? { ...prev, points: 0 } : null));
      toast.success(`Points remis à 0 pour ${card.customer_name} !`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la remise à zéro.");
    } finally {
      setResettingPoints(false);
    }
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === "error" || !card) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <CreditCard className="size-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Carte introuvable</p>
        <p className="text-sm text-muted-foreground">
          Ce lien est invalide ou la carte n'existe plus.
        </p>
      </div>
    );
  }

  const theme = themes.find((t) => t.id === card.theme_id) ?? themes[0]!;

  // Récompenses pour type points
  const unlockable = card.rewards.filter((r) => r.points_cost <= card.points);
  const nextReward = card.rewards
    .filter((r) => r.points_cost > card.points)
    .sort((a, b) => a.points_cost - b.points_cost)[0];

  // Calculs VIP
  let nextThreshold = card.vip_silver_threshold;
  let nextTierName = "Silver";
  if (card.vip_tier === "silver") {
    nextThreshold = card.vip_gold_threshold;
    nextTierName = "Gold";
  }
  const vipProgressPercent =
    card.vip_tier === "gold"
      ? 100
      : Math.min(100, Math.round((card.vip_spent / nextThreshold) * 100));

  // Calculs Tampons
  const stampsCompleted = card.stamps_count >= card.stamps_target;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* En-tête */}
      <div className="bg-surface-muted px-4 py-5 sm:py-6 text-center">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {card.card_type === "vip"
            ? "Programme VIP"
            : card.card_type === "stamps"
            ? "Carte à Tampons"
            : "Programme de fidélité"}
        </p>
        <p className="mt-1 font-display text-xl sm:text-2xl font-bold truncate max-w-xs mx-auto">
          {card.merchant_name}
        </p>
        {card.merchant_category && (
          <p className="text-xs sm:text-sm text-muted-foreground">{card.merchant_category}</p>
        )}
      </div>

      <div className="mx-auto max-w-sm space-y-5 px-3.5 sm:px-4 pt-4 sm:pt-6">
        {/* Bandeau Mode Commerçant */}
        {isMerchant && (
          <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-3.5 py-2.5 text-xs text-primary font-medium">
            <span className="flex items-center gap-1.5 font-bold">
              <Sparkles className="size-3.5" />
              Commerçant connecté
            </span>
            {card.card_type === "points" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                disabled={resettingPoints || card.points === 0}
                onClick={handleResetPoints}
              >
                <RotateCcw className={cn("size-3 mr-1", resettingPoints && "animate-spin")} />
                {resettingPoints ? "En cours…" : "Mettre à 0"}
              </Button>
            )}
          </div>
        )}

        {/* Carte virtuelle interactive */}
        <div className="w-full">
          <VirtualCard
            theme={theme}
            businessName={card.merchant_name}
            customerName={card.customer_name}
            cardType={card.card_type}
            cardName={card.card_name || undefined}
            points={card.points}
            stampsCount={card.stamps_count}
            stampsTarget={card.stamps_target}
            stampReward={card.stamp_reward}
            vipTier={card.vip_tier}
            vipSpent={card.vip_spent}
            compact={false}
          />
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* BLOC 1 : CARTE VIP                                            */}
        {/* ───────────────────────────────────────────────────────────── */}
        {card.card_type === "vip" && (
          <div className="space-y-4">
            <div className="card-surface space-y-3 p-4 sm:p-5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <Crown className="size-3.5" />
                NIVEAU {card.vip_tier.toUpperCase()}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Total de vos achats
                </p>
                <p className="font-display text-4xl sm:text-5xl font-extrabold text-foreground mt-0.5">
                  {card.vip_spent.toLocaleString("fr-FR")}{" "}
                  <span className="text-xl font-normal text-muted-foreground">DA</span>
                </p>
              </div>

              {/* Jauge vers le palier supérieur */}
              {card.vip_tier !== "gold" ? (
                <div className="space-y-1.5 pt-2 text-left">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Objectif {nextTierName}</span>
                    <span className="font-mono">{card.vip_spent.toLocaleString()} / {nextThreshold.toLocaleString()} DA</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-surface-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                      style={{ width: `${vipProgressPercent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right">
                    Plus que <strong>{Math.max(0, nextThreshold - card.vip_spent).toLocaleString()} DA</strong> pour débloquer le niveau {nextTierName} !
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center justify-center gap-1.5">
                  <Sparkles className="size-4" />
                  Vous bénéficiez du statut VIP Gold maximum !
                </div>
              )}
            </div>

            {/* Avantages par palier */}
            <div className="card-surface p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Crown className="size-3.5 text-amber-500" /> Vos avantages VIP
              </p>
              <div className="space-y-2 text-xs">
                {/* Bronze */}
                <div className={cn(
                  "p-2.5 rounded-lg border flex items-start justify-between gap-2",
                  card.vip_spent >= card.vip_bronze_threshold
                    ? "bg-amber-500/10 border-amber-500/30 text-foreground"
                    : "bg-surface-muted opacity-60"
                )}>
                  <div className="flex-1">
                    <span className="font-bold">🥉 Niveau Bronze</span>
                    <div className="space-y-0.5 mt-0.5">
                      {(card.vip_bronze_benefits || "-5% de réduction")
                        .split("|")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((b, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="text-[10px] text-amber-500">•</span>
                            <span>{b}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {card.vip_spent >= card.vip_bronze_threshold && (
                    <CheckCircle2 className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Silver */}
                <div className={cn(
                  "p-2.5 rounded-lg border flex items-start justify-between gap-2",
                  card.vip_spent >= card.vip_silver_threshold
                    ? "bg-slate-500/10 border-slate-500/30 text-foreground"
                    : "bg-surface-muted opacity-60"
                )}>
                  <div className="flex-1">
                    <span className="font-bold">🥈 Niveau Silver (dès {card.vip_silver_threshold.toLocaleString()} DA)</span>
                    <div className="space-y-0.5 mt-0.5">
                      {(card.vip_silver_benefits || "-10% de réduction")
                        .split("|")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((b, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="text-[10px] text-slate-500">•</span>
                            <span>{b}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {card.vip_spent >= card.vip_silver_threshold && (
                    <CheckCircle2 className="size-4 text-slate-600 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* Gold */}
                <div className={cn(
                  "p-2.5 rounded-lg border flex items-start justify-between gap-2",
                  card.vip_spent >= card.vip_gold_threshold
                    ? "bg-yellow-500/10 border-yellow-500/30 text-foreground"
                    : "bg-surface-muted opacity-60"
                )}>
                  <div className="flex-1">
                    <span className="font-bold">🥇 Niveau Gold (dès {card.vip_gold_threshold.toLocaleString()} DA)</span>
                    <div className="space-y-0.5 mt-0.5">
                      {(card.vip_gold_benefits || "-15% de réduction")
                        .split("|")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((b, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="text-[10px] text-yellow-500">•</span>
                            <span>{b}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {card.vip_spent >= card.vip_gold_threshold && (
                    <CheckCircle2 className="size-4 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* BLOC 2 : CARTE À TAMPONS                                      */}
        {/* ───────────────────────────────────────────────────────────── */}
        {card.card_type === "stamps" && (
          <div className="space-y-4">
            <div className="card-surface p-4 sm:p-5 space-y-4 text-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vos tampons validés
                </p>
                <p className="font-display text-4xl sm:text-5xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  {card.stamps_count}{" "}
                  <span className="text-xl font-normal text-muted-foreground">/ {card.stamps_target}</span>
                </p>
              </div>

              {/* Grille de tampons interactive */}
              <div className="grid grid-cols-5 gap-2.5 pt-1">
                {Array.from({ length: card.stamps_target }).map((_, idx) => {
                  const isStamped = idx < card.stamps_count;
                  const isLast = idx === card.stamps_target - 1;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "aspect-square rounded-2xl flex flex-col items-center justify-center font-bold text-sm border-2 transition-all shadow-sm",
                        isStamped
                          ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20 scale-105"
                          : isLast
                          ? "bg-amber-500/10 text-amber-600 border-amber-500/40"
                          : "bg-surface-muted text-muted-foreground border-border/80"
                      )}
                    >
                      {isStamped ? (
                        <Check className="size-5 stroke-[3]" />
                      ) : isLast ? (
                        <Gift className="size-5 text-amber-500 animate-pulse" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bannière de récompense */}
              <div className={cn(
                "rounded-xl p-3.5 text-center space-y-1 border",
                stampsCompleted
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
                  : "bg-surface-muted border-border text-foreground"
              )}>
                <p className="text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <Gift className="size-4 text-emerald-600 dark:text-emerald-400" />
                  {stampsCompleted ? "🎉 Cadeau débloqué !" : "Récompense finale"}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {card.stamp_reward}
                </p>
                {card.stamp_conditions && (
                  <p className="text-[11px] text-muted-foreground italic">
                    {card.stamp_conditions}
                  </p>
                )}
                {stampsCompleted && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 pt-1">
                    Présentez cette page lors de votre prochain passage pour recevoir votre cadeau !
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* BLOC 3 : CARTE À POINTS (CLASSIQUE)                           */}
        {/* ───────────────────────────────────────────────────────────── */}
        {card.card_type === "points" && (
          <div className="space-y-4">
            {/* Solde de points */}
            <div className="card-surface space-y-2.5 p-4 sm:p-6 text-center">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Solde de points
                </p>
                {isMerchant && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={resettingPoints || card.points === 0}
                    onClick={handleResetPoints}
                    className="h-7 px-2.5 text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 shadow-sm"
                    title={card.points === 0 ? "Le solde est déjà à 0" : "Remettre les points à zéro"}
                  >
                    <RotateCcw className={cn("size-3 mr-1", resettingPoints && "animate-spin")} />
                    {resettingPoints ? "En cours…" : "Mettre à 0 pt"}
                  </Button>
                )}
              </div>
              <p className="font-display text-5xl sm:text-6xl font-extrabold text-primary">{card.points}</p>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">points disponibles</p>
              <div className="pt-3 text-xs text-muted-foreground border-t border-border flex flex-col xs:flex-row gap-1.5 items-center justify-between text-center xs:text-left">
                <span>Client : <strong className="text-foreground">{card.customer_name}</strong></span>
                <span>Total cumulé : <strong className="text-foreground">{card.total_earned} pts</strong></span>
              </div>
            </div>

            {/* Récompenses débloquées */}
            {unlockable.length > 0 && (
              <div className="card-surface p-4 sm:p-5">
                <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
                  <Award className="size-4" />
                  Récompenses disponibles
                </p>
                <ul className="space-y-2">
                  {unlockable.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-lg bg-success/5 px-3 py-2 text-xs sm:text-sm"
                    >
                      <span className="font-medium truncate mr-2">{r.name}</span>
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success shrink-0">
                        {r.points_cost} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prochaine récompense */}
            {nextReward && (
              <div className="card-surface p-4 sm:p-5">
                <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold">
                  <Star className="size-4 text-warning" />
                  Prochaine récompense
                </p>
                <div className="rounded-lg bg-surface-muted px-3 py-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium truncate mr-2">{nextReward.name}</span>
                    <span className="text-muted-foreground shrink-0">{nextReward.points_cost} pts</span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, Math.round((card.points / nextReward.points_cost) * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-right text-[11px] sm:text-xs text-muted-foreground">
                    encore {nextReward.points_cost - card.points} points
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boutons d'action : Copier / Partager */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11 sm:h-10 text-xs sm:text-sm" onClick={handleCopy}>
            {copied ? <Check className="mr-1.5 size-4 text-success" /> : <Copy className="mr-1.5 size-4" />}
            {copied ? "Lien copié !" : "Copier mon lien"}
          </Button>
          <Button variant="outline" className="flex-1 h-11 sm:h-10 text-xs sm:text-sm" onClick={handleShare}>
            <Share2 className="mr-1.5 size-4" />
            Partager
          </Button>
        </div>

        <p className="text-center text-[11px] sm:text-xs text-muted-foreground px-2">
          Enregistrez ce lien dans vos favoris pour consulter vos avantages à tout moment chez {card.merchant_name}.
        </p>
      </div>
    </div>
  );
}
