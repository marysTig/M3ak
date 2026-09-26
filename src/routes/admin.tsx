import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Activity, LayoutDashboard, Settings, Store, Users } from "lucide-react";

import { DashboardShell, type NavItem } from "@/components/app/dashboard-shell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/businesses", label: "Businesses", icon: Store },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/activity", label: "Activity", icon: Activity },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  return (
    <DashboardShell
      brand="Loyalty Platform"
      brandSub="Platform admin"
      items={items}
      profile={{ name: "Alex Moreau", sub: "Platform admin", initials: "AM" }}
    >
      <Outlet />
    </DashboardShell>
  );
}
