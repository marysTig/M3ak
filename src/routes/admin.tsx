import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Activity, LayoutDashboard, Settings, Store, Users } from "lucide-react";

import { DashboardShell, type NavItem } from "@/components/app/dashboard-shell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Aperçu", icon: LayoutDashboard, exact: true },
  { to: "/admin/businesses", label: "Commerces", icon: Store },
  { to: "/admin/customers", label: "Clients", icon: Users },
  { to: "/admin/activity", label: "Activité", icon: Activity },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

function AdminLayout() {
  return (
    <DashboardShell
      brand="Plateforme de Fidélité"
      brandSub="Administration de la plateforme"
      items={items}
      profile={{ name: "Alex Moreau", sub: "Administrateur de la plateforme", initials: "AM" }}
    >
      <Outlet />
    </DashboardShell>
  );
}
