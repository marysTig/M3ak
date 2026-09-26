import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  Gift,
  LayoutDashboard,
  QrCode,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";

import { DashboardShell, type NavItem } from "@/components/app/dashboard-shell";
import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business")({
  component: BusinessLayout,
});

const items: NavItem[] = [
  { to: "/business", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/business/program", label: "Loyalty Program", icon: Sparkles },
  { to: "/business/customers", label: "Customers", icon: Users },
  { to: "/business/transactions", label: "Transactions", icon: Receipt },
  { to: "/business/rewards", label: "Rewards", icon: Gift },
  { to: "/business/qr", label: "QR Code", icon: QrCode },
  { to: "/business/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/business/settings", label: "Settings", icon: Settings },
];

function BusinessLayout() {
  return (
    <DashboardShell
      brand="Loyalty Platform"
      brandSub="Business workspace"
      items={items}
      profile={{ name: business.name, sub: business.category, initials: "BC" }}
    >
      <Outlet />
    </DashboardShell>
  );
}
