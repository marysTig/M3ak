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

  useEffect(() => {
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
    if (!joinLink || typeof window === "undefined" || !navigator.share) return;
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
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Partager mon lien"
        subtitle="Partagez ce lien avec vos clients pour qu'ils rejoignent votre programme de fidélité."
      />

      <div className="grid gap-5 sm:gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card-surface flex flex-col items-center gap-5 p-4 sm:p-8 text-center">
          <div className="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Share2 className="size-8 sm:size-10" />
          </div>

          <div>
            <p className="font-display text-xl sm:text-2xl font-bold">{merchant?.name ?? "—"}</p>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Lien d'adhésion client</p>
          </div>

          {/* Bloc lien */}
          <div className="w-full max-w-md rounded-xl border bg-surface-muted p-3.5 sm:p-4 space-y-2.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lien unique de votre commerce</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-background px-2.5 py-2 text-xs font-mono">
                {joinLink || "Chargement du lien…"}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                disabled={!joinLink}
                className="shrink-0"
              >
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                <span className="ml-1.5">{copied ? "Copié !" : "Copier"}</span>
              </Button>
            </div>
          </div>

          {/* Boutons de partage rapides */}
          <div className="grid w-full max-w-md grid-cols-2 gap-2.5 sm:gap-3">
            <Button
              onClick={handleShareWhatsApp}
              disabled={!joinLink}
              className="bg-[#25D366] hover:bg-[#1ebe59] text-white h-11"
            >
              <MessageCircle className="mr-2 size-4" />
              WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={handleShareSMS}
              disabled={!joinLink}
              className="h-11"
            >
              <Smartphone className="mr-2 size-4" />
              SMS
            </Button>
          </div>

          {typeof window !== "undefined" && navigator.share && (
            <Button
              variant="outline"
              onClick={handleNativeShare}
              disabled={!joinLink}
              className="w-full max-w-md h-11"
            >
              <Share2 className="mr-2 size-4" />
              Partager via une autre application
            </Button>
          )}
        </div>

        <div className="card-surface h-fit p-5 sm:p-6">
          <h2 className="font-semibold text-sm sm:text-base">Comment ça fonctionne ?</h2>
          <ol className="mt-4 space-y-3 sm:space-y-4">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-xs sm:text-sm">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 rounded-xl bg-surface-muted p-3.5 text-xs text-muted-foreground">
            Les clients n'ont pas besoin de mot de passe compliqué ni de télécharger une application. Un simple clic sur votre lien leur permet de voir leur carte et cumuler des points.
          </p>
        </div>
      </div>
    </div>
  );
}
