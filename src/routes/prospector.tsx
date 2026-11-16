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
    if (typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      navigate({ to: "/" });
    }
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
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/prospector" className="flex items-center gap-2.5 group">
              <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs border border-border/60 p-1 group-hover:scale-105 transition-transform">
                <img
                  src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
                  alt="M3ak Logo"
                  className="size-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-foreground text-sm tracking-tight leading-none">
                  M3AK CRM
                </span>
                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">Espace Commercial</span>
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
              className="text-xs text-slate-700 dark:text-slate-300 font-medium hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 h-8 transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="size-3.5 text-slate-600 dark:text-slate-400 group-hover:text-rose-600" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted">
        M3ak Commercial CRM &copy; {new Date().getFullYear()} — Solution de Fidélité Commerçante
      </footer>
    </div>
  );
}

