import { createFileRoute, Outlet, Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Home, IdCard, LogOut, Settings, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business")({
  component: BusinessLayout,
});

const navItems = [
  { to: "/business" as const, label: "Accueil", icon: Home, exact: true },
  { to: "/business/customers" as const, label: "Clients", icon: Users },
  { to: "/business/program" as const, label: "Modifier ma carte", icon: IdCard },
  { to: "/business/settings" as const, label: "Paramètres", icon: Settings },
];

function BusinessLayout() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isRoot = matchRoute({ to: "/business" as const });
  const { profile, loading } = useAuthGuard("merchant");

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

  const name = profile?.full_name ?? "Mon commerce";
  const initials = profile?.initials ?? "M";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-3.5 py-2.5 sm:px-6 sm:py-3 backdrop-blur">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {!isRoot ? (
            <Link to="/business" className="flex size-9 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <ArrowLeft className="size-5" />
            </Link>
          ) : (
            <button
              onClick={handleSignOut}
              className="flex size-9 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors"
              aria-label="Se déconnecter"
            >
              <LogOut className="size-5" />
            </button>
          )}
          <span className="font-display text-sm font-semibold truncate max-w-[200px] sm:max-w-none">{name}</span>
        </div>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shrink-0">
          {initials}
        </span>
      </header>

      <main className="flex-1 w-full max-w-[800px] mx-auto p-3.5 sm:p-6 pb-24 sm:pb-8">
        <Outlet />
      </main>

      {/* Barre de navigation mobile pour utilisation sur téléphone */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur sm:hidden">
        <ul className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive = matchRoute({ to: item.to, fuzzy: !item.exact });
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact ?? false }}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
                    isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-5 transition-transform", isActive && "scale-110")} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
