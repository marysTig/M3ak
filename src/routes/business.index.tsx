import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, IdCard, QrCode, Settings, Users } from "lucide-react";

import { Progress } from "@/components/ui/progress";

import { business } from "@/lib/mock-data";

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
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold">Bonjour, {business.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Gérez votre commerce en toute simplicité.</p>
      </div>

      {/* Boutons d'action principaux */}
      <div className="mb-4 flex w-full max-w-md gap-3">
        <Link
          to="/business/qr"
          className="flex flex-1 items-center justify-center rounded-2xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)] transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
        >
          Scanner code QR
        </Link>
        <Link
          to="/business/customers"
          className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-surface px-4 py-4 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)] transition-all hover:bg-accent active:scale-95 whitespace-nowrap"
        >
          Créer une nouvelle carte
        </Link>
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

      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Compte Activé</h3>
              <p className="text-xs text-muted-foreground">Validé par l'administrateur</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-primary">2500 DA</p>
            <p className="text-xs text-muted-foreground">/ mois</p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-primary">30 jours restants</span>
            <span className="text-muted-foreground">Sur 30 jours</span>
          </div>
          <Progress value={100} className="h-2 bg-secondary" />
          <p className="text-[10px] text-muted-foreground text-center mt-1">Le décompte a commencé lors de l'activation</p>
        </div>
      </div>
    </div>
  );
}
