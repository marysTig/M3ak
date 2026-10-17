import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, IdCard, QrCode, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { NewCardDialog } from "@/components/app/new-card-dialog";
import { ScanPointsDialog } from "@/components/app/scan-points-dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import type { Merchant } from "@/lib/auth";

export const Route = createFileRoute("/business/")({
  component: Overview,
});

const menuItems = [
  { to: "/business/program", label: "Ma carte", icon: IdCard, color: "bg-blue-500/10 text-blue-500" },
  { to: "/business/customers", label: "Mes clients", icon: Users, color: "bg-green-500/10 text-green-500" },
  { to: "/business/qr", label: "Code QR", icon: QrCode, color: "bg-purple-500/10 text-purple-500" },
  { to: "/business/settings", label: "Paramètres", icon: Settings, color: "bg-orange-500/10 text-orange-500" },
];

function Overview() {
  const [scanOpen, setScanOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("merchants")
        .select("*")
        .eq("owner_id", user.id)
        .single();
      if (data) {
        setMerchant(data as Merchant);
        // Calculer les jours restants depuis la création du compte
        const created = new Date(data.created_at);
        const subscriptionEnd = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
        const remaining = Math.max(0, Math.ceil((subscriptionEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
        setDaysRemaining(remaining);
      }
    });
  }, []);

  const name = merchant?.name ?? "Mon commerce";

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold">Bonjour, {name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gérez votre commerce en toute simplicité.</p>
      </div>

      {/* Boutons d'action principaux */}
      <div className="mb-4 flex w-full max-w-md gap-3">
        <button
          id="btn-scan-qr"
          onClick={() => setScanOpen(true)}
          className="flex flex-1 items-center justify-center rounded-2xl bg-primary px-3 py-4 text-center text-xs font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-95 sm:px-4 sm:text-sm"
        >
          Scanner code QR
        </button>
        <button
          id="btn-nouvelle-carte"
          onClick={() => setNewCardOpen(true)}
          className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-surface px-3 py-4 text-center text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] transition-all hover:bg-accent active:scale-95 sm:px-4 sm:text-sm"
        >
          Créer une nouvelle carte
        </button>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center transition-all hover:bg-accent hover:shadow-[var(--shadow-soft)] active:scale-95"
          >
            <span className={`flex size-14 items-center justify-center rounded-full ${item.color}`}>
              <item.icon className="size-6" />
            </span>
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Statut du compte */}
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">
                {merchant?.status === "active" ? "Compte Activé" : merchant?.status === "pending" ? "En attente de validation" : "Compte suspendu"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {merchant?.plan ? `Plan ${merchant.plan}` : "Validé par l'administrateur"}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">2500 DA</p>
            <p className="text-xs text-muted-foreground">/ mois</p>
          </div>
        </div>

        {daysRemaining !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-primary">{daysRemaining} jours restants</span>
              <span className="text-muted-foreground">Sur 30 jours</span>
            </div>
            <Progress value={(daysRemaining / 30) * 100} className="h-2 bg-secondary" />
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Le décompte a commencé lors de l'activation
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ScanPointsDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onPointsAdded={() => {
          toast.success("Points ajoutés avec succès");
        }}
      />
      <NewCardDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        onCreated={() => {}}
      />
    </div>
  );
}
