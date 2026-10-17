import { createFileRoute, Outlet, Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export const Route = createFileRoute("/business")({
  component: BusinessLayout,
});

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
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
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
          <span className="font-display text-sm font-semibold">{name}</span>
        </div>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
      </header>
      <main className="flex-1 w-full max-w-[800px] mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
