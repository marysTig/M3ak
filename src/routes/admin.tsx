import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  Store,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell, type NavSection } from "@/components/app/dashboard-shell";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { safeSignOut } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => search,
  component: AdminLayout,
});

const sections: NavSection[] = [
  {
    title: "Plateforme",
    items: [
      { to: "/admin", label: "Aperçu", icon: LayoutDashboard, exact: true },
      { to: "/admin/businesses", label: "Commerces", icon: Store },
      { to: "/admin/settings", label: "Paramètres", icon: Settings },
    ],
  },
  {
    title: "Prospection",
    items: [
      {
        id: "prospection",
        label: "Prospection",
        icon: Target,
        children: [
          {
            id: "prospection-overview",
            label: "Vue d'ensemble",
            to: "/admin/prospection",
          },
        ],
      },
      {
        id: "team",
        label: "Équipe commerciale",
        icon: Users,
        children: [
          {
            id: "team-all",
            label: "Tous les prospecteurs",
            to: "/admin/prospection/team",
            search: { tab: "all" },
          },
          {
            id: "team-add",
            label: "Ajouter un prospecteur",
            to: "/admin/prospection/team",
            search: { tab: "new" },
          },
          {
            id: "team-perf",
            label: "Performances",
            to: "/admin/prospection/team",
            search: { tab: "perf" },
          },
        ],
      },
      {
        id: "prospects",
        label: "Gestion des prospects",
        icon: Building2,
        children: [
          {
            id: "prospects-all",
            label: "Tous les commerces",
            to: "/admin/prospection/prospects",
            search: { tab: "all" },
          },
          {
            id: "prospects-import",
            label: "Importer des prospects",
            to: "/admin/prospection/prospects",
            search: { tab: "import" },
          },
          {
            id: "prospects-assign",
            label: "Attribution des listes",
            to: "/admin/prospection/prospects",
            search: { tab: "assign" },
          },
        ],
      },
      {
        id: "pipeline",
        label: "Suivi commercial",
        icon: TrendingUp,
        children: [
          {
            id: "pipeline-board",
            label: "Pipeline commercial",
            to: "/admin/prospection/pipeline",
            search: { tab: "kanban" },
          },
          {
            id: "pipeline-trials",
            label: "Essais gratuits",
            to: "/admin/prospection/pipeline",
            search: { tab: "trials" },
          },
          {
            id: "pipeline-followups",
            label: "Relances",
            to: "/admin/prospection/pipeline",
            search: { tab: "followups" },
          },
          {
            id: "pipeline-converted",
            label: "Clients convertis",
            to: "/admin/prospection/pipeline",
            search: { tab: "converted" },
          },
        ],
      },
      {
        id: "commissions",
        label: "Commissions",
        icon: CircleDollarSign,
        children: [
          {
            id: "commissions-overview",
            label: "Vue générale",
            to: "/admin/prospection/commissions",
            search: { tab: "overview" },
          },
          {
            id: "commissions-pending",
            label: "Commissions à payer",
            to: "/admin/prospection/commissions",
            search: { tab: "pending" },
          },
          {
            id: "commissions-history",
            label: "Historique des paiements",
            to: "/admin/prospection/commissions",
            search: { tab: "payouts" },
          },
        ],
      },
      {
        id: "reports",
        label: "Rapports et statistiques",
        icon: BarChart3,
        to: "/admin/prospection/reports",
      },
      {
        id: "prospection-settings",
        label: "Paramètres de prospection",
        icon: SlidersHorizontal,
        to: "/admin/prospection/settings",
      },
    ],
  },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { profile, loading } = useAuthGuard("admin");

  async function handleSignOut() {
    await safeSignOut();
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
      sections={sections}
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
