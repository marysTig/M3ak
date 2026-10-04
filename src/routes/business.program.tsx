import { createFileRoute } from "@tanstack/react-router";
import { Check, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { QrDisplay } from "@/components/app/qr-display";
import { Button } from "@/components/ui/button";
import { getMerchantTheme, saveMerchantTheme, MERCHANT_ID } from "@/lib/loyalty-store";
import { cn } from "@/lib/utils";
import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business/program")({
  head: () => ({
    meta: [
      { title: `Ma carte — ${business.name}` },
      {
        name: "description",
        content: "Personnalisez l'apparence de votre carte de fidélité virtuelle.",
      },
      { property: "og:title", content: `Ma carte — ${business.name}` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaCartePage,
});

// 8 thèmes Mesh Gradient
export const themes: {
  id: string;
  label: string;
  mesh: string;
  textColor: string;
}[] = [
  {
    id: "aurora",
    label: "Aurora",
    mesh: `
      radial-gradient(ellipse at 20% 20%, #a78bfa 0%, transparent 55%),
      radial-gradient(ellipse at 80% 10%, #38bdf8 0%, transparent 50%),
      radial-gradient(ellipse at 60% 80%, #34d399 0%, transparent 55%),
      radial-gradient(ellipse at 10% 80%, #818cf8 0%, transparent 50%),
      #0f172a
    `,
    textColor: "#fff",
  },
  {
    id: "sunset",
    label: "Sunset",
    mesh: `
      radial-gradient(ellipse at 10% 30%, #f97316 0%, transparent 55%),
      radial-gradient(ellipse at 80% 10%, #fbbf24 0%, transparent 50%),
      radial-gradient(ellipse at 70% 80%, #ec4899 0%, transparent 55%),
      radial-gradient(ellipse at 20% 90%, #f43f5e 0%, transparent 50%),
      #1c0a00
    `,
    textColor: "#fff",
  },
  {
    id: "ocean",
    label: "Ocean",
    mesh: `
      radial-gradient(ellipse at 15% 20%, #06b6d4 0%, transparent 55%),
      radial-gradient(ellipse at 85% 15%, #3b82f6 0%, transparent 50%),
      radial-gradient(ellipse at 50% 85%, #0ea5e9 0%, transparent 55%),
      radial-gradient(ellipse at 5% 75%, #6366f1 0%, transparent 50%),
      #020617
    `,
    textColor: "#fff",
  },
  {
    id: "rose",
    label: "Rose Gold",
    mesh: `
      radial-gradient(ellipse at 20% 25%, #fda4af 0%, transparent 55%),
      radial-gradient(ellipse at 80% 15%, #fb923c 0%, transparent 50%),
      radial-gradient(ellipse at 65% 75%, #f472b6 0%, transparent 55%),
      radial-gradient(ellipse at 10% 80%, #e879f9 0%, transparent 50%),
      #1a0010
    `,
    textColor: "#fff",
  },
  {
    id: "forest",
    label: "Forest",
    mesh: `
      radial-gradient(ellipse at 25% 20%, #4ade80 0%, transparent 55%),
      radial-gradient(ellipse at 75% 10%, #a3e635 0%, transparent 50%),
      radial-gradient(ellipse at 55% 80%, #2dd4bf 0%, transparent 55%),
      radial-gradient(ellipse at 10% 70%, #34d399 0%, transparent 50%),
      #021a0a
    `,
    textColor: "#fff",
  },
  {
    id: "candy",
    label: "Candy",
    mesh: `
      radial-gradient(ellipse at 15% 15%, #f9a8d4 0%, transparent 55%),
      radial-gradient(ellipse at 80% 20%, #c4b5fd 0%, transparent 50%),
      radial-gradient(ellipse at 50% 85%, #93c5fd 0%, transparent 55%),
      radial-gradient(ellipse at 10% 80%, #fbcfe8 0%, transparent 50%),
      #0d0620
    `,
    textColor: "#1a1d21",
  },
  {
    id: "fire",
    label: "Fire",
    mesh: `
      radial-gradient(ellipse at 20% 10%, #fef08a 0%, transparent 50%),
      radial-gradient(ellipse at 75% 20%, #f97316 0%, transparent 55%),
      radial-gradient(ellipse at 60% 80%, #dc2626 0%, transparent 55%),
      radial-gradient(ellipse at 10% 75%, #b45309 0%, transparent 50%),
      #1a0500
    `,
    textColor: "#fff",
  },
  {
    id: "midnight",
    label: "Midnight",
    mesh: `
      radial-gradient(ellipse at 20% 20%, #312e81 0%, transparent 55%),
      radial-gradient(ellipse at 80% 10%, #1e1b4b 0%, transparent 50%),
      radial-gradient(ellipse at 65% 80%, #4c1d95 0%, transparent 55%),
      radial-gradient(ellipse at 5% 80%, #1e40af 0%, transparent 50%),
      #020010
    `,
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
}) {
  const initials = getInitials(businessName);
  const isLight = theme.textColor === "#1a1d21";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative box-border grid w-full cursor-pointer grid-rows-[1fr_auto] overflow-hidden rounded-2xl text-left transition-all duration-300",
        compact ? "h-[160px] p-4" : "h-[227px] p-6",
        "shadow-[0_4px_20px_rgb(0_0_0/30%),0_12px_40px_rgb(0_0_0/20%)]",
        selected
          ? "ring-4 ring-white/70 ring-offset-2 ring-offset-transparent scale-[1.03]"
          : "hover:scale-[1.02] hover:shadow-[0_8px_32px_rgb(0_0_0/40%)]",
      )}
      style={{ background: theme.mesh, color: theme.textColor }}
    >
      {/* Shimmer overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(120deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.18) 40%, rgba(255,255,255,0.06) 40%), linear-gradient(0deg, rgba(255,255,255,0.08), rgba(255,255,255,0.16))",
        }}
      />
      {/* Inset border */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.15)",
        }}
      />

      {selected && (
        <span className="absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-full bg-white/90 shadow">
          <Check className="size-3.5 text-primary" />
        </span>
      )}

      {/* Top */}
      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p
            className="text-[9px] font-semibold uppercase tracking-[2px]"
            style={{ color: theme.textColor, opacity: 0.6 }}
          >
            Carte de fidélité
          </p>
          <p
            className={cn(
              "mt-0.5 max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap font-bold tracking-wide",
              compact ? "text-sm" : "text-base",
            )}
            style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}
          >
            {businessName}
          </p>
          {category && !compact && (
            <p
              className="text-[10px]"
              style={{ color: theme.textColor, opacity: 0.55 }}
            >
              {category}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {qrToken ? (
            <div className="rounded-xl bg-white p-1.5 shadow-md">
              <QrDisplay token={qrToken} size={compact ? 75 : 95} label="" />
            </div>
          ) : (
            <span
              className={cn(
                "flex items-center justify-center rounded-xl font-bold",
                isLight ? "text-white" : "text-white",
                compact ? "size-8 text-xs" : "size-10 text-sm",
              )}
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <p
            className="text-[9px] font-semibold uppercase tracking-[2px]"
            style={{ color: theme.textColor, opacity: 0.6 }}
          >
            Points
          </p>
          <p
            className={cn("font-bold", compact ? "text-lg" : "text-2xl")}
            style={{ color: theme.textColor, textShadow: "0 1px 8px rgba(0,0,0,0.2)" }}
          >
            {points}
          </p>
        </div>
        <div className="text-right">
          <p
            className="text-[9px] font-medium uppercase tracking-widest"
            style={{ color: theme.textColor, opacity: 0.5 }}
          >
            {theme.label}
          </p>
          {customerName && (
            <p
              className={cn("mt-1 font-semibold", compact ? "text-xs" : "text-sm")}
              style={{ color: theme.textColor }}
            >
              {customerName}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function MaCartePage() {
  // Charger le thème sauvegardé du commerçant depuis le store
  const [selectedId, setSelectedId] = useState<string>(() => getMerchantTheme(MERCHANT_ID));
  const selected = themes.find((t) => t.id === selectedId) ?? themes[0];

  // Synchroniser si le thème change dans localStorage (multi-onglets)
  useEffect(() => {
    const stored = getMerchantTheme(MERCHANT_ID);
    if (stored !== selectedId) setSelectedId(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader
        title="Ma carte virtuelle"
        subtitle="Choisissez le thème Mesh Gradient de votre carte."
        actions={
          <Button
            onClick={() => {
              // Persister le thème dans le store — sera utilisé pour les nouvelles cartes
              saveMerchantTheme(MERCHANT_ID, selected.id);
              toast.success("Carte sauvegardée", {
                description: `Thème « ${selected.label} » appliqué à toutes les nouvelles cartes.`,
              });
            }}
          >
            <Save className="size-4" />
            Sauvegarder
          </Button>
        }
      />

      <div className="space-y-8">
        {/* ── Aperçu principal ── */}
        <section className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-muted-foreground">Aperçu de votre carte</p>
          <div className="w-full max-w-[360px]">
            <VirtualCard
              theme={selected}
              businessName={business.name}
              category={business.category}
              points={120}
            />
          </div>
        </section>

        {/* ── Sélecteur de thèmes ── */}
        <section className="card-surface space-y-4 p-5">
          <h2 className="font-semibold">Choisir un thème</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {themes.map((theme) => (
              <VirtualCard
                key={theme.id}
                theme={theme}
                businessName={business.name}
                selected={selectedId === theme.id}
                onClick={() => setSelectedId(theme.id)}
                compact
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
