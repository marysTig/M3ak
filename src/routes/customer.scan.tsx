import { createFileRoute } from "@tanstack/react-router";
import { Check, ScanLine, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoyaltyCard } from "@/components/app/loyalty-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMerchantBySlug } from "@/lib/db/merchants";
import { joinMerchant } from "@/lib/db/cards";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/customer/scan")({
  head: () => ({
    meta: [
      { title: "Rejoindre un commerce — Fidélité" },
      { name: "description", content: "Scannez le QR code d'un commerce pour rejoindre son programme de fidélité." },
      { property: "og:title", content: "Rejoindre un commerce — Fidélité" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

type Step = "scan" | "preview" | "joined";

function ScanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    if (!slugInput.trim()) {
      toast.error("Entrez un slug de commerce.");
      return;
    }
    setLoading(true);
    try {
      const m = await getMerchantBySlug(slugInput.trim());
      if (!m) {
        toast.error("Commerce introuvable ou inactif.");
        return;
      }
      setMerchant(m);
      setSlug(slugInput.trim());
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!merchant) return;
    setLoading(true);
    try {
      const result = await joinMerchant(slug);
      setAlreadyMember(result.already_member);
      setStep("joined");
      if (result.already_member) {
        toast.info(`Vous êtes déjà membre de ${merchant.name}`);
      } else {
        toast.success(`Vous avez rejoint ${merchant.name}`, {
          description: "+10 points de bienvenue",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'adhésion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Rejoindre un commerce</h1>
        <p className="text-sm text-muted-foreground">
          Scannez le QR au comptoir — aucun nouveau compte requis.
        </p>
      </div>

      {step === "scan" && (
        <div className="space-y-4">
          {/* Zone de scan simulée */}
          <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border border-border bg-foreground/90">
            <div className="absolute inset-10 rounded-2xl border-2 border-dashed border-background/40" />
            <div className="relative flex flex-col items-center gap-3 text-background">
              <ScanLine className="size-10 animate-pulse" />
              <p className="text-sm opacity-80">Pointez la caméra sur le QR code</p>
            </div>
          </div>

          {/* Saisie manuelle du slug */}
          <div className="card-surface space-y-3 p-4">
            <p className="text-sm font-medium">Ou entrez le slug du commerce manuellement :</p>
            <div className="space-y-2">
              <Label htmlFor="slug-input">Slug du commerce</Label>
              <Input
                id="slug-input"
                placeholder="ex: bloom-cafe"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
              />
            </div>
            <Button className="w-full" onClick={handleSimulate} disabled={loading}>
              {loading ? "Recherche…" : "Rechercher le commerce"}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Le scan caméra nécessite une intégration hardware. Utilisez le slug pour tester.
          </p>
        </div>
      )}

      {step === "preview" && merchant && (
        <div className="space-y-4">
          <div className="card-surface space-y-2 p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Sparkles className="size-5" />
            </span>
            <p className="font-display text-lg font-semibold">{merchant.name}</p>
            <p className="text-sm text-muted-foreground">{merchant.category}</p>
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs">
              Rejoignez le programme de fidélité · +10 points de bienvenue
            </p>
          </div>
          <Button className="w-full" onClick={handleJoin} disabled={loading}>
            {loading ? "Adhésion en cours…" : "Rejoindre le programme"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { setStep("scan"); setMerchant(null); }}>
            Annuler
          </Button>
        </div>
      )}

      {step === "joined" && merchant && (
        <div className="space-y-4">
          <div className="card-surface flex flex-col items-center gap-2 p-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Check className="size-6" />
            </span>
            <p className="font-display text-lg font-semibold">
              {alreadyMember ? "Déjà membre !" : "Vous êtes inscrit !"}
            </p>
            <p className="text-sm text-muted-foreground">
              {alreadyMember
                ? `Vous êtes déjà membre de ${merchant.name}.`
                : `${merchant.name} a été ajouté à votre portefeuille fidélité.`}
            </p>
          </div>
          <LoyaltyCard
            business={merchant.name}
            category={merchant.category ?? ""}
            points={alreadyMember ? 0 : 10}
            nextReward=""
            nextRewardAt={100}
            accent="var(--color-chart-1)"
            initials={merchant.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setStep("scan"); setMerchant(null); setSlugInput(""); }}
          >
            Scanner un autre commerce
          </Button>
        </div>
      )}
    </>
  );
}
