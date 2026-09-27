import { createFileRoute, Link } from "@tanstack/react-router";
import { QrCode, Settings, Sparkles, Users } from "lucide-react";

import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business/")({
  component: Overview,
});

const menuItems = [
  { to: "/business/program", label: "Programme de fidélité", icon: Sparkles, color: "bg-blue-500/10 text-blue-500" },
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

      <div className="grid w-full max-w-md gap-4 sm:grid-cols-2">
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
    </div>
  );
}
