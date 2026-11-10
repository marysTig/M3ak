import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, IdCard, Settings, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NewCardDialog } from "@/components/app/new-card-dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/business/")({
  component: Overview,
});

const menuItems = [
  {
    to: "/business/program",
    label: "Modifier ma carte",
    sub: "Personnaliser le thème de votre carte",
    icon: IdCard,
    color: "bg-blue-500/10 text-blue-500",
    featured: true,
  },
  {
    to: "/business/customers",
    label: "Mes clients",
    icon: Users,
    color: "bg-green-500/10 text-green-500",
    featured: false,
  },
  {
    to: "/business/settings",
    label: "Paramètres",
    icon: Settings,
    color: "bg-orange-500/10 text-orange-500",
    featured: false,
  },
];

function Overview() {
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [totalDays, setTotalDays] = useState<number>(30);
  const [expiryFormatted, setExpiryFormatted] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      let { data } = await supabase
        .from("merchants")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      // Si le commerce n'existe pas encore pour ce compte, on le crée automatiquement
      if (!data) {
        const rawUser = (user.email ?? "").replace("@m3ak.app", "") || "moncommerce";
        const mName = user.user_metadata?.full_name || rawUser;
        const slug = rawUser.toLowerCase().replace(/[^a-z0-9]/g, "-");

        const { data: created } = await supabase
          .from("merchants")
          .upsert({
            owner_id: user.id,
            name: mName,
            slug,
            status: "active",
            plan: "starter",
          }, { onConflict: "slug" })
          .select()
          .maybeSingle();

        if (created) data = created;
      }

      if (data) {
        const m = data as Merchant;
        const now = Date.now();
        const isExpiredByDate = m.subscription_expires_at
          ? new Date(m.subscription_expires_at).getTime() <= now
          : false;

        const effectiveStatus = (isExpiredByDate || m.status === "suspended") ? "suspended" : m.status;
        setMerchant({ ...m, status: effectiveStatus });

        if (m.subscription_expires_at) {
          const expDate = new Date(m.subscription_expires_at);
          const diffMs = expDate.getTime() - now;
          const remaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setDaysRemaining(remaining);
          setExpiryFormatted(expDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }));

          // Estimer la durée totale de l'activation (30 jours ou 365 jours)
          const baseDate = new Date(m.updated_at || m.created_at).getTime();
          const approxDays = Math.round((expDate.getTime() - baseDate) / (1000 * 60 * 60 * 24));
          setTotalDays(approxDays > 60 ? 365 : 30);

          // Si expiré mais statut encore actif en DB, désactiver automatiquement
          if (isExpiredByDate && m.status === "active") {
            supabase
              .from("merchants")
              .update({ status: "suspended", updated_at: new Date().toISOString() })
              .eq("id", m.id)
              .then();
          }
        } else {
          setDaysRemaining(null);
        }
      }
    });
  }, []);

  const name = merchant?.name ?? "Mon commerce";
  const isSuspended = merchant?.status === "suspended" || (daysRemaining !== null && daysRemaining <= 0);

  function handleNewCardClick() {
    if (isSuspended) {
      toast.error("Compte désactivé ou expiré", {
        description: "Votre période d'activation a expiré ou votre compte est désactivé. Veuillez contacter l'administrateur pour renouveler.",
      });
      return;
    }
    setNewCardOpen(true);
  }

  return (
    <div className="flex flex-col items-center justify-center py-3 sm:py-8">
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-xl sm:text-2xl font-bold">Bonjour, {name}</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Gérez votre commerce en toute simplicité.</p>
      </div>

      {isSuspended && (
        <div className="mb-5 flex w-full max-w-md items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 p-3.5 sm:p-4 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <div className="text-xs">
            <p className="font-semibold">
              {daysRemaining !== null && daysRemaining <= 0 ? "Abonnement expiré" : "Compte désactivé"}
            </p>
            <p className="mt-0.5 opacity-90">
              {daysRemaining !== null && daysRemaining <= 0
                ? "Votre période d'activation a pris fin. Le compte a été désactivé automatiquement. Contactez l'administrateur pour renouveler."
                : "Votre compte est désactivé par l'administrateur. Certaines fonctionnalités sont temporairement restreintes."}
            </p>
          </div>
        </div>
      )}

      {/* Boutons d'action principaux */}
      <div className="mb-4 flex w-full max-w-md gap-2.5 sm:gap-3">
        <button
          id="btn-nouvelle-carte"
          onClick={handleNewCardClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-3 py-3.5 sm:py-4 text-center text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-95 sm:px-4 sm:text-sm"
        >
          <UserPlus className="size-4" />
          Créer une carte
        </button>
        <Link
          to="/business/customers"
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3.5 sm:py-4 text-center text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] transition-all hover:bg-accent active:scale-95 sm:px-4 sm:text-sm"
        >
          <Users className="size-4" />
          Mes clients
        </Link>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3 sm:gap-4">
        {menuItems.map((item) =>
          item.featured ? (
            <Link
              key={item.to}
              to={item.to}
              className="col-span-2 flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 text-left transition-all hover:bg-accent hover:shadow-[var(--shadow-soft)] active:scale-95"
            >
              <span className={`flex size-12 sm:size-14 items-center justify-center rounded-full shrink-0 ${item.color}`}>
                <item.icon className="size-6" />
              </span>
              <div className="min-w-0">
                <span className="block text-sm sm:text-base font-semibold text-foreground">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.sub}</span>
              </div>
            </Link>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-2.5 sm:gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-6 text-center transition-all hover:bg-accent hover:shadow-[var(--shadow-soft)] active:scale-95"
            >
              <span className={`flex size-12 sm:size-14 items-center justify-center rounded-full ${item.color}`}>
                <item.icon className="size-5 sm:size-6" />
              </span>
              <span className="text-xs sm:text-sm font-medium">{item.label}</span>
            </Link>
          )
        )}
      </div>

      {/* Statut du compte */}
      <div className="mt-6 sm:mt-8 w-full max-w-md rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className={`flex size-9 sm:size-10 items-center justify-center rounded-full ${isSuspended ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
              {isSuspended ? <AlertCircle className="size-4 sm:size-5" /> : <CheckCircle2 className="size-4 sm:size-5" />}
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold">
                {isSuspended ? "Compte Expiré / Désactivé" : merchant?.status === "active" ? "Compte Activé" : "En attente de validation"}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                {isSuspended ? "Activation terminée" : merchant?.plan ? `Plan ${merchant.plan}` : "Compte actif"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs sm:text-sm font-bold text-primary">2500 DA</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">/ mois</p>
          </div>
        </div>

        {merchant?.subscription_expires_at && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${isSuspended ? "text-destructive" : (daysRemaining ?? 0) <= 7 ? "text-warning font-semibold" : "text-primary"}`}>
                {isSuspended
                  ? "Période d'activation expirée"
                  : `${daysRemaining} jour${(daysRemaining ?? 0) > 1 ? "s" : ""} restant${(daysRemaining ?? 0) > 1 ? "s" : ""}`}
              </span>
              <span className="text-muted-foreground text-[11px]">
                {totalDays >= 365 ? "Durée : 1 an" : "Durée : 1 mois (30j)"}
              </span>
            </div>
            {!isSuspended && daysRemaining !== null && daysRemaining > 0 && (
              <Progress value={Math.min(100, Math.max(0, (daysRemaining / totalDays) * 100))} className="h-2 bg-secondary" />
            )}
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              {isSuspended
                ? `Expiré le ${expiryFormatted || "—"}`
                : `Date de fin : ${expiryFormatted} (désactivation automatique)`}
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={() => {}}
      />
    </div>
  );
}
