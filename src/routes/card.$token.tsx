/**
 * card.$token.tsx — Vue publique de la carte de fidélité
 *
 * Accessible sans compte. Affiche la carte du client avec son solde de points
 * et les récompenses disponibles du commerce.
 * URL : /card/{qr_token}
 */
import { createFileRoute } from "@tanstack/react-router";
import { Award, Loader2, QrCode, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { QrDisplay } from "@/components/app/qr-display";
import { VirtualCard, themes } from "@/routes/business.program";
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

  useEffect(() => {
    async function load() {
      try {
        // Lire la carte via qr_token (politique RLS permettant la lecture publique par token)
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
        <QrCode className="size-12 text-muted-foreground" />
        <p className="text-lg font-semibold">Carte introuvable</p>
        <p className="text-sm text-muted-foreground">
          Ce lien est invalide ou la carte n'existe plus.
        </p>
      </div>
    );
  }

  const theme = themes.find((t) => t.id === card.theme_id) ?? themes[0]!;

  // Récompenses atteignables et prochaine
  const unlockable = card.rewards.filter((r) => r.points_cost <= card.points);
  const nextReward = card.rewards
    .filter((r) => r.points_cost > card.points)
    .sort((a, b) => a.points_cost - b.points_cost)[0];

  return (
    <div className="min-h-screen bg-background pb-10">
      {/* Header */}
      <div className="bg-surface-muted px-4 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Programme de fidélité
        </p>
        <p className="mt-1 font-display text-2xl font-bold">{card.merchant_name}</p>
        {card.merchant_category && (
          <p className="text-sm text-muted-foreground">{card.merchant_category}</p>
        )}
      </div>

      <div className="mx-auto max-w-sm space-y-6 px-4 pt-6">
        {/* Carte virtuelle */}
        <VirtualCard
          theme={theme}
          businessName={card.merchant_name}
          points={card.points}
          customerName={card.customer_name}
          compact={false}
        />

        {/* Solde + QR */}
        <div className="card-surface space-y-4 p-5 text-center">
          <div>
            <p className="font-display text-5xl font-bold text-primary">{card.points}</p>
            <p className="mt-1 text-sm text-muted-foreground">points disponibles</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              QR Code — à présenter au caissier
            </p>
            <QrDisplay token={card.qr_token} size={180} />
          </div>

          <p className="text-xs text-muted-foreground">
            Total cumulé : <span className="font-semibold text-foreground">{card.total_earned} pts</span>
          </p>
        </div>

        {/* Récompenses débloquées */}
        {unlockable.length > 0 && (
          <div className="card-surface p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-success">
              <Award className="size-4" />
              Récompenses disponibles
            </p>
            <ul className="space-y-2">
              {unlockable.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded-lg bg-success/5 px-3 py-2 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    {r.points_cost} pts
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prochaine récompense */}
        {nextReward && (
          <div className="card-surface p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Star className="size-4 text-warning" />
              Prochaine récompense
            </p>
            <div className="rounded-lg bg-surface-muted px-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{nextReward.name}</span>
                <span className="text-muted-foreground">{nextReward.points_cost} pts</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.round((card.points / nextReward.points_cost) * 100))}%` }}
                />
              </div>
              <p className="mt-1.5 text-right text-xs text-muted-foreground">
                encore {nextReward.points_cost - card.points} points
              </p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Présentez le QR Code ci-dessus lors de votre prochain achat pour accumuler des points.
        </p>
      </div>
    </div>
  );
}
