import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  CheckCircle2,
  Gift,
  HelpCircle,
  LogOut,
  MapPin,
  ShieldCheck,
  TrendingUp,
  User,
  UserCheck,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { safeSignOut } from "@/lib/auth";

export const Route = createFileRoute("/prospector")({
  head: () => ({
    meta: [
      { title: "Dashboard Prospecteur — M3ak Commercial" },
      { name: "description", content: "Espace commercial dédié aux prospecteurs terrain M3ak." },
    ],
  }),
  component: ProspectorLayout,
});

function ProspectorLayout() {
  const navigate = useNavigate();
  const { profile, loading } = useAuthGuard("prospector");

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs text-muted">Chargement de votre espace commercial...</span>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await safeSignOut();
    navigate({ to: "/prospector/login" });
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "PR";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Barre de navigation supérieure Prospecteur */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/prospector" className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-base shadow-sm">
                M
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-sm tracking-tight leading-none">
                  M3AK CRM
                </span>
                <span className="text-[10px] text-muted font-medium">Espace Commercial</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Profil utilisateur connecté */}
            <div className="flex items-center gap-2.5 bg-surface/90 border border-border/60 py-1 px-3 rounded-full">
              <Avatar className="size-7 border border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-foreground leading-tight">
                  {profile?.full_name}
                </div>
                <div className="text-[10px] text-muted font-mono">
                  @{profile?.username || "commercial"}
                </div>
              </div>
            </div>

            {/* Bouton de déconnexion */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted hover:text-rose-500 gap-1.5 h-8"
              title="Se déconnecter"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted">
        M3ak Commercial CRM &copy; {new Date().getFullYear()} — Solution de Fidélité Commerçante
      </footer>
    </div>
  );
}

