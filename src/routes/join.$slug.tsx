import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getMerchantBySlug } from "@/lib/db/merchants";
import { joinMerchant } from "@/lib/db/cards";
import type { Merchant } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/join/$slug")({
  head: () => ({
    meta: [
      { title: "Rejoindre — M3ak Fidélité" },
      { name: "description", content: "Rejoignez le programme de fidélité de ce commerce." },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { slug } = useParams({ from: "/join/$slug" });
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [step, setStep] = useState<"loading" | "preview" | "auth" | "joined" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function init() {
      // Vérifier la session
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);

      // Charger le commerce
      try {
        const m = await getMerchantBySlug(slug);
        if (!m) {
          setStep("error");
          return;
        }
        setMerchant(m);
        setStep("preview");
      } catch {
        setStep("error");
      }
    }
    init();
  }, [slug]);

  async function handleJoin() {
    if (!merchant) return;

    if (!isLoggedIn) {
      // Rediriger vers la page de connexion avec retour
      navigate({ to: "/", search: { redirect: `/join/${slug}` } as Record<string, string> });
      toast.info("Connectez-vous pour rejoindre ce commerce.");
      return;
    }

    setJoining(true);
    try {
      const result = await joinMerchant(slug);
      setAlreadyMember(result.already_member);
      setStep("joined");
      if (!result.already_member) {
        toast.success(`Vous avez rejoint ${merchant.name} !`, {
          description: "+10 points de bienvenue",
        });
      } else {
        toast.info(`Vous êtes déjà membre de ${merchant.name}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'adhésion.");
    } finally {
      setJoining(false);
    }
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-lg font-semibold">Commerce introuvable</p>
        <p className="text-sm text-muted-foreground">Ce lien n'est plus valide ou le commerce est inactif.</p>
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>Retour à l'accueil</Button>
      </div>
    );
  }

  if (step === "joined" && merchant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-8" />
        </span>
        <div>
          <p className="font-display text-2xl font-bold">
            {alreadyMember ? "Déjà membre !" : "Bienvenue !"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {alreadyMember
              ? `Vous êtes déjà membre de ${merchant.name}.`
              : `Vous avez rejoint ${merchant.name}. +10 points de bienvenue.`}
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/customer" })}>Voir mon portefeuille</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Sparkles className="size-8" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Programme de fidélité</p>
        <p className="mt-1 font-display text-2xl font-bold">{merchant?.name}</p>
        {merchant?.category && (
          <p className="text-sm text-muted-foreground">{merchant.category}</p>
        )}
      </div>
      <div className="w-full max-w-xs rounded-xl bg-surface-muted p-4 text-left text-sm">
        <p className="font-medium">En rejoignant :</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>✓ +10 points de bienvenue offerts</li>
          <li>✓ Carte ajoutée à votre portefeuille</li>
          <li>✓ Gagnez des points à chaque visite</li>
          <li>✓ Échangez contre des récompenses</li>
        </ul>
      </div>
      <Button className="w-full max-w-xs" onClick={handleJoin} disabled={joining}>
        {joining ? <Loader2 className="size-4 animate-spin" /> : null}
        {joining ? "Adhésion en cours…" : "Rejoindre le programme"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/" })}>
        Plus tard
      </Button>
    </div>
  );
}
