import { createFileRoute } from "@tanstack/react-router";
import { Award, Check, Crown, Flame, Save, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { saveTheme, getLoyaltyProgram, ensureLoyaltyProgram } from "@/lib/db/program";
import { getMyMerchant } from "@/lib/db/merchants";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/business/program")({
  head: () => ({
    meta: [
      { title: "Modifier ma carte — M3ak Loyalty" },
      { name: "description", content: "Personnalisez l'apparence de votre carte de fidélité virtuelle." },
      { property: "og:title", content: "Modifier ma carte — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaCartePage,
});

// 8 thèmes Mesh Gradient
export const themes: { id: string; label: string; mesh: string; textColor: string }[] = [
  {
    id: "aurora", label: "Aurora",
    mesh: `radial-gradient(ellipse at 20% 20%, #a78bfa 0%, transparent 55%),radial-gradient(ellipse at 80% 10%, #38bdf8 0%, transparent 50%),radial-gradient(ellipse at 60% 80%, #34d399 0%, transparent 55%),radial-gradient(ellipse at 10% 80%, #818cf8 0%, transparent 50%),#0f172a`,
    textColor: "#fff",
  },
  {
    id: "sunset", label: "Sunset",
    mesh: `radial-gradient(ellipse at 10% 30%, #f97316 0%, transparent 55%),radial-gradient(ellipse at 80% 10%, #fbbf24 0%, transparent 50%),radial-gradient(ellipse at 70% 80%, #ec4899 0%, transparent 55%),radial-gradient(ellipse at 20% 90%, #f43f5e 0%, transparent 50%),#1c0a00`,
    textColor: "#fff",
  },
  {
    id: "ocean", label: "Ocean",
    mesh: `radial-gradient(ellipse at 15% 20%, #06b6d4 0%, transparent 55%),radial-gradient(ellipse at 85% 15%, #3b82f6 0%, transparent 50%),radial-gradient(ellipse at 50% 85%, #0ea5e9 0%, transparent 55%),radial-gradient(ellipse at 5% 75%, #6366f1 0%, transparent 50%),#020617`,
    textColor: "#fff",
  },
  {
    id: "rose", label: "Rose Gold",
    mesh: `radial-gradient(ellipse at 20% 25%, #fda4af 0%, transparent 55%),radial-gradient(ellipse at 80% 15%, #fb923c 0%, transparent 50%),radial-gradient(ellipse at 65% 75%, #f472b6 0%, transparent 55%),radial-gradient(ellipse at 10% 80%, #e879f9 0%, transparent 50%),#1a0010`,
    textColor: "#fff",
  },
  {
    id: "forest", label: "Forest",
    mesh: `radial-gradient(ellipse at 25% 20%, #4ade80 0%, transparent 55%),radial-gradient(ellipse at 75% 10%, #a3e635 0%, transparent 50%),radial-gradient(ellipse at 55% 80%, #2dd4bf 0%, transparent 55%),radial-gradient(ellipse at 10% 70%, #34d399 0%, transparent 50%),#021a0a`,
    textColor: "#fff",
  },
  {
    id: "candy", label: "Candy",
    mesh: `radial-gradient(ellipse at 15% 15%, #f9a8d4 0%, transparent 55%),radial-gradient(ellipse at 80% 20%, #c4b5fd 0%, transparent 50%),radial-gradient(ellipse at 50% 85%, #93c5fd 0%, transparent 55%),radial-gradient(ellipse at 10% 80%, #fbcfe8 0%, transparent 50%),#0d0620`,
    textColor: "#1a1d21",
  },
  {
    id: "fire", label: "Fire",
    mesh: `radial-gradient(ellipse at 20% 10%, #fef08a 0%, transparent 50%),radial-gradient(ellipse at 75% 20%, #f97316 0%, transparent 55%),radial-gradient(ellipse at 60% 80%, #dc2626 0%, transparent 55%),radial-gradient(ellipse at 10% 75%, #b45309 0%, transparent 50%),#1a0500`,
    textColor: "#fff",
  },
  {
    id: "midnight", label: "Midnight",
    mesh: `radial-gradient(ellipse at 20% 20%, #312e81 0%, transparent 55%),radial-gradient(ellipse at 80% 10%, #1e1b4b 0%, transparent 50%),radial-gradient(ellipse at 65% 80%, #4c1d95 0%, transparent 55%),radial-gradient(ellipse at 5% 80%, #1e40af 0%, transparent 50%),#020010`,
    textColor: "#fff",
  },
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export function VirtualCard({
  theme,
  businessName,
  category,
  points = 120,
  customerName,
  qrToken,
  selected,
  onClick,
  compact = false,
  cardType = "points",
  cardName,
  stampsCount = 0,
  stampsTarget = 10,
  stampReward,
  vipTier = "bronze",
  vipSpent = 0,
}: {
  theme: (typeof themes)[number];
  businessName: string;
  category?: string;
  points?: number;
  customerName?: string;
  qrToken?: string;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
  cardType?: "points" | "vip" | "stamps";
  cardName?: string;
  stampsCount?: number;
  stampsTarget?: number;
  stampReward?: string;
  vipTier?: "bronze" | "silver" | "gold";
  vipSpent?: number;
}) {
  const initials = getInitials(businessName);
  const isLight = theme.textColor === "#1a1d21";

  const tierColors: Record<string, { label: string; badgeBg: string; text: string; border: string }> = {
    bronze: { label: "BRONZE", badgeBg: "rgba(180, 83, 9, 0.4)", text: "#fed7aa", border: "rgba(251, 146, 60, 0.5)" },
    silver: { label: "SILVER", badgeBg: "rgba(148, 163, 184, 0.4)", text: "#f1f5f9", border: "rgba(203, 213, 225, 0.6)" },
    gold: { label: "GOLD", badgeBg: "rgba(234, 179, 8, 0.4)", text: "#fef08a", border: "rgba(250, 204, 21, 0.7)" },
  };
  const currentTier = tierColors[vipTier] || tierColors.bronze;

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative box-border grid w-full cursor-pointer grid-rows-[1fr_auto] overflow-hidden rounded-2xl text-left transition-all duration-300",
        compact ? "h-[150px] sm:h-[165px] p-3.5 sm:p-4" : "min-h-[195px] sm:h-[230px] p-4 sm:p-6",
        "shadow-[0_4px_20px_rgb(0_0_0/30%),0_12px_40px_rgb(0_0_0/20%)]",
        selected
          ? "ring-4 ring-white/70 ring-offset-2 ring-offset-transparent scale-[1.03]"
          : "hover:scale-[1.02] hover:shadow-[0_8px_32px_rgb(0_0_0/40%)]",
      )}
      style={{ background: theme.mesh, color: theme.textColor }}
    >
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(120deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.06) 40%), linear-gradient(0deg, rgba(255,255,255,0.08), rgba(255,255,255,0.16))" }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)" }}
      />

      {selected && (
        <span className="absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-full bg-white/90 shadow">
          <Check className="size-3.5 text-primary" />
        </span>
      )}

      {/* Header section */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[9px] font-bold uppercase tracking-[1.5px] px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
            >
              {cardType === "vip"
                ? "CARTE VIP"
                : cardType === "stamps"
                ? "CARTE À TAMPONS"
                : "CARTE DE FIDÉLITÉ"}
            </span>
            {cardName && (
              <span className="text-[10px] opacity-80 truncate max-w-[140px]">
                · {cardName}
              </span>
            )}
          </div>

          <p className={cn("mt-1 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap font-bold tracking-wide", compact ? "text-sm" : "text-base")}
            style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}>
            {businessName}
          </p>
          {category && !compact && (
            <p className="text-[10px]" style={{ color: theme.textColor, opacity: 0.55 }}>{category}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={cn("flex items-center justify-center rounded-xl font-bold", isLight ? "text-white" : "text-white", compact ? "size-8 text-xs" : "size-10 text-sm")}
            style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          >
            {initials}
          </span>
          {cardType === "vip" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase shadow-sm"
              style={{
                background: currentTier.badgeBg,
                color: currentTier.text,
                border: `1px solid ${currentTier.border}`,
                backdropFilter: "blur(6px)",
              }}
            >
              <Crown className="size-2.5" />
              {currentTier.label}
            </span>
          )}
        </div>
      </div>

      {/* Bottom section depending on cardType */}
      <div className="relative z-10 flex items-end justify-between pt-2">
        <div className="min-w-0">
          {customerName && (
            <p className={cn("font-medium truncate max-w-[180px] sm:max-w-[220px]", compact ? "text-xs mb-0.5" : "text-sm mb-1")}
              style={{ color: theme.textColor, opacity: 0.9 }}>
              {customerName}
            </p>
          )}

          {cardType === "vip" ? (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[1.5px]" style={{ color: theme.textColor, opacity: 0.7 }}>
                Achats cumulés
              </p>
              <p className={cn("font-bold leading-tight flex items-baseline gap-1", compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl")}
                style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}>
                <span>{vipSpent.toLocaleString("fr-FR")}</span>
                <span className="text-xs font-normal opacity-80">DA</span>
              </p>
            </div>
          ) : cardType === "stamps" ? (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[1.5px]" style={{ color: theme.textColor, opacity: 0.7 }}>
                Tampons validés
              </p>
              <p className={cn("font-bold leading-tight", compact ? "text-base sm:text-lg" : "text-xl sm:text-2xl")}
                style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}>
                {stampsCount} <span className="text-xs font-normal opacity-80">/ {stampsTarget}</span>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[2px]" style={{ color: theme.textColor, opacity: 0.6 }}>Points</p>
              <p className={cn("font-bold leading-tight", compact ? "text-lg" : "text-2xl")}
                style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}>
                {points}
              </p>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          {cardType === "stamps" && stampReward ? (
            <div className="max-w-[140px] text-right">
              <span
                className="inline-block text-[9px] px-2 py-0.5 rounded-md truncate max-w-full font-medium"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
                title={stampReward}
              >
                🎁 {stampReward}
              </span>
            </div>
          ) : (
            <p className="text-[9px] font-medium uppercase tracking-widest" style={{ color: theme.textColor, opacity: 0.55 }}>
              {theme.label}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function MaCartePage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [selectedId, setSelectedId] = useState<string>("aurora");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMyMerchant().then(async (m) => {
      if (m) {
        setMerchant(m);
        // Charger le thème depuis Supabase
        const prog = await getLoyaltyProgram(m.id);
        if (prog?.theme_id) setSelectedId(prog.theme_id);
      }
    });
  }, []);

  const selected = themes.find((t) => t.id === selectedId) ?? themes[0]!;

  async function handleSave() {
    if (!merchant) return;
    setSaving(true);
    try {
      await ensureLoyaltyProgram(merchant.id);
      await saveTheme(merchant.id, selected.id);
      toast.success("Carte sauvegardée", {
        description: `Thème « ${selected.label} » appliqué à toutes les nouvelles cartes.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modifier ma carte"
        subtitle="Choisissez le thème Mesh Gradient de votre carte."
        actions={
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            <Save className="size-4" />
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </Button>
        }
      />

      <div className="space-y-6">
        <section className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-muted-foreground">Aperçu de votre carte</p>
          <div className="w-full max-w-[360px]">
            <VirtualCard
              theme={selected}
              businessName={merchant?.name ?? "Mon commerce"}
              {...(merchant?.category ? { category: merchant.category } : {})}
              points={120}
            />
          </div>
        </section>

        <section className="card-surface space-y-4 p-4 sm:p-5">
          <h2 className="font-semibold text-sm sm:text-base">Choisir un thème</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {themes.map((theme) => (
              <VirtualCard
                key={theme.id}
                theme={theme}
                businessName={merchant?.name ?? "Mon commerce"}
                selected={selectedId === theme.id}
                onClick={() => setSelectedId(theme.id)}
                compact
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
