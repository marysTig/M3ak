import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, MessageCircle, Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { getMyMerchant } from "@/lib/db/merchants";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/business/qr")({
  head: () => ({
    meta: [
      { title: "Lien de Fidélité — M3ak" },
      { name: "description", content: "Partagez votre lien de fidélité pour que vos clients rejoignent votre programme." },
      { property: "og:title", content: "Lien de Fidélité — M3ak" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShareLinkPage,
});

const steps = [
  "Partagez votre lien boutique par WhatsApp, SMS ou réseaux sociaux.",
  "Vos clients cliquent sur le lien.",
  "Ils rejoignent votre programme et reçoivent leurs points de bienvenue.",
  "Leur carte est enregistrée sans créer de mot de passe compliqué.",
];

function ShareLinkPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [joinLink, setJoinLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasNativeShare, setHasNativeShare] = useState(false);

  useEffect(() => {
    setHasNativeShare(typeof navigator !== "undefined" && !!navigator.share);
    getMyMerchant().then(async (m) => {
      if (m) {
        setMerchant(m);
        const slug = m.slug ?? m.id;
        const link = `${window.location.origin}/join/${slug}`;
        setJoinLink(link);
      }
    });
  }, []);

  async function handleCopyLink() {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopied(true);
      toast.success("Lien d'adhésion copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  function handleShareWhatsApp() {
    if (!joinLink) return;
    const msg = encodeURIComponent(
      `Rejoignez le programme de fidélité de *${merchant?.name ?? "notre commerce"}* et profitez de récompenses exclusives !\n\nCliquez ici : ${joinLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
  }

  function handleShareSMS() {
    if (!joinLink) return;
    const msg = encodeURIComponent(
      `Rejoignez le programme de fidélité de ${merchant?.name ?? "notre commerce"} : ${joinLink}`
    );
    window.open(`sms:?body=${msg}`, "_self");
  }

  async function handleNativeShare() {
    if (!joinLink || !navigator.share) return;
    try {
      await navigator.share({
        title: `Programme de fidélité ${merchant?.name ?? ""}`,
        text: `Rejoignez le programme de fidélité de ${merchant?.name ?? "notre commerce"} !`,
        url: joinLink,
      });
    } catch {
      // Annulé
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Partager mon lien"
        subtitle="Partagez ce lien avec vos clients pour qu'ils rejoignent votre programme de fidélité."
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_360px]">

        {/* ── Carte principale ── */}
        <div className="card-surface p-4 sm:p-6 space-y-4">

          {/* En-tête : icône + nom du commerce */}
          <div className="flex items-center gap-3">
            <div className="flex size-12 sm:size-14 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Share2 className="size-6 sm:size-7" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-base sm:text-xl font-bold leading-tight truncate">
                {merchant?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Lien d'adhésion client</p>
            </div>
          </div>

          {/* Bloc lien */}
          <div className="rounded-xl border bg-surface-muted p-3 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Lien unique de votre commerce
            </p>
            <code className="block w-full break-all rounded-lg bg-background px-3 py-2.5 text-xs font-mono leading-relaxed">
              {joinLink || "Chargement du lien…"}
            </code>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              disabled={!joinLink}
              className="w-full h-10 rounded-xl gap-2"
            >
              {copied
                ? <Check className="size-4 text-success" />
                : <Copy className="size-4" />}
              {copied ? "Lien copié !" : "Copier le lien"}
            </Button>
          </div>

          {/* Boutons de partage */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button
              onClick={handleShareWhatsApp}
              disabled={!joinLink}
              className="bg-[#25D366] hover:bg-[#1ebe59] text-white h-12 rounded-xl gap-2 text-sm"
            >
              <MessageCircle className="size-4 shrink-0" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={handleShareSMS}
              disabled={!joinLink}
              className="h-12 rounded-xl gap-2 text-sm"
            >
              <Smartphone className="size-4 shrink-0" />
              SMS
            </Button>
          </div>

          {/* Partage natif (Android / iOS) */}
          {hasNativeShare && (
            <Button
              variant="outline"
              onClick={handleNativeShare}
              disabled={!joinLink}
              className="w-full h-11 rounded-xl gap-2"
            >
              <Share2 className="size-4" />
              Partager via l'appareil
            </Button>
          )}
        </div>

        {/* ── Comment ça fonctionne ? ── */}
        <div className="card-surface h-fit p-4 sm:p-6 space-y-3">
          <h2 className="font-semibold text-sm sm:text-base">Comment ça fonctionne ?</h2>
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3 items-start">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s}</span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-surface-muted p-3 text-xs text-muted-foreground leading-relaxed">
            Les clients n'ont pas besoin de mot de passe compliqué ni de télécharger une application.
            Un simple clic sur votre lien leur permet de voir leur carte et cumuler des points.
          </p>
        </div>
      </div>
    </div>
  );
}
