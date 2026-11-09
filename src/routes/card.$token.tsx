/**
 * card.$token.tsx — Vue publique de la carte de fidélité
 *
 * Accessible sans compte. Affiche la carte du client avec son solde de points
 * et les récompenses disponibles du commerce.
 * URL : /card/{qr_token}
 */
import { createFileRoute } from "@tanstack/react-router";
import { Award, Check, Copy, CreditCard, Loader2, Share2, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

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
  points: number;
  total_earned: number;
  status: string;
  customer_name: string;
  merchant_name: string;
  merchant_category: string | null;
  merchant_logo: string | null;
  theme_id: string;
  rewards: { id: string; name: string; points_cost: number; active: boolean }[];
}

function PublicCardPage() {
  const { token } = Route.useParams();
  const [card, setCard] = useState<CardInfo | null>(null);
  const [step, setStep] = useState<"loading" | "found" | "error">("loading");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("loyalty_cards")
          .select(`
            id,
            qr_token,
            points,
            total_earned,
            status,
            profiles!loyalty_cards_customer_id_fkey (full_name),
            merchants!loyalty_cards_merchant_id_fkey (
              id, name, category, logo_url,
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

        setCard({
          id: data.id,
          qr_token: data.qr_token,
          points: data.points,
          total_earned: data.total_earned,
          status: data.status,
          customer_name: profile?.full_name ?? "Client",
          merchant_name: merchant?.name ?? "Commerce",
          merchant_category: merchant?.category ?? null,
          merchant_logo: merchant?.logo_url ?? null,
          theme_id: program?.theme_id ?? "aurora",
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
          text: `Voici ma carte de fidélité ${card.merchant_name} avec ${card.points} points !`,
          url: window.location.href,
        });
      } catch {
        // Annulé
      }
    } else {
      handleCopy();
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

  const unlockable = card.rewards.filter((r) => r.points_cost <= card.points);
  const nextReward = card.rewards
    .filter((r) => r.points_cost > card.points)
    .sort((a, b) => a.points_cost - b.points_cost)[0];

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-surface-muted px-4 py-5 sm:py-6 text-center">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Programme de fidélité
        </p>
        <p className="mt-1 font-display text-xl sm:text-2xl font-bold truncate max-w-xs mx-auto">{card.merchant_name}</p>
        {card.merchant_category && (
          <p className="text-xs sm:text-sm text-muted-foreground">{card.merchant_category}</p>
        )}
      </div>

      <div className="mx-auto max-w-sm space-y-5 px-3.5 sm:px-4 pt-4 sm:pt-6">
        {/* Carte virtuelle */}
        <div className="w-full">
          <VirtualCard
            theme={theme}
            businessName={card.merchant_name}
            points={card.points}
            customerName={card.customer_name}
            compact={false}
          />
        </div>

        {/* Solde de points */}
        <div className="card-surface space-y-2.5 p-4 sm:p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solde de points</p>
          <p className="font-display text-5xl sm:text-6xl font-extrabold text-primary">{card.points}</p>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">points disponibles</p>
          <div className="pt-3 text-xs text-muted-foreground border-t border-border flex flex-col xs:flex-row gap-1.5 items-center justify-between text-center xs:text-left">
            <span>Client : <strong className="text-foreground">{card.customer_name}</strong></span>
            <span>Total cumulé : <strong className="text-foreground">{card.total_earned} pts</strong></span>
          </div>
        </div>

        {/* Bouton pour enregistrer / partager le lien */}
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

        {/* Récompenses débloquées */}
        {unlockable.length > 0 && (
          <div className="card-surface p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
              <Award className="size-4" />
              Récompenses disponibles
            </p>
            <ul className="space-y-2">
              {unlockable.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-success/5 px-3 py-2 text-xs sm:text-sm">
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

        <p className="text-center text-[11px] sm:text-xs text-muted-foreground px-2">
          Enregistrez ce lien dans vos favoris pour consulter votre solde à tout moment chez {card.merchant_name}.
        </p>
      </div>
    </div>
  );
}

