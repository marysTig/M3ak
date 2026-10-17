import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Activity, LayoutDashboard, LogOut, Settings, Store, Users } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell, type NavItem } from "@/components/app/dashboard-shell";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const items: NavItem[] = [
  { to: "/admin", label: "Aperçu", icon: LayoutDashboard, exact: true },
  { to: "/admin/businesses", label: "Commerces", icon: Store },
  { to: "/admin/customers", label: "Clients", icon: Users },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { profile, loading } = useAuthGuard("admin");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    navigate({ to: "/" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <DashboardShell
      brand="M3ak Admin"
      brandSub="Administration de la plateforme"
      items={items}
      profile={{
        name: profile?.full_name ?? "Admin",
        sub: `@${profile?.username ?? "admin"} · Administrateur`,
        initials: profile?.initials ?? "A",
      }}
      onSignOut={handleSignOut}
    >
      <Outlet />
    </DashboardShell>
  );
}
