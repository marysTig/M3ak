import { createFileRoute, Outlet, Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft, Gift, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { safeSignOut, type Merchant } from "@/lib/auth";
import { getMyMerchant } from "@/lib/db/merchants";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isRoot = matchRoute({ to: "/business" as const });
  const { profile, loading } = useAuthGuard("merchant");
  const [merchant, setMerchant] = useState<Merchant | null>(null);

  useEffect(() => {
    getMyMerchant().then(setMerchant);
  }, []);

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

  const name = profile?.full_name ?? "Mon commerce";
  const initials = profile?.initials ?? "M";

  const isTrial = merchant?.is_trial !== false;
  const now = Date.now();
  const isExpired = merchant?.subscription_expires_at
    ? new Date(merchant.subscription_expires_at).getTime() <= now
    : false;
  const isSuspended = merchant?.status === "suspended" || isExpired;
  const daysRemaining = merchant?.subscription_expires_at
    ? Math.max(0, Math.ceil((new Date(merchant.subscription_expires_at).getTime() - now) / (1000 * 60 * 60 * 24)))
    : null;

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

      {/* Bandeau d'information Mode Gratuit */}
      {merchant && merchant.subscription_expires_at && isTrial && (
        <div
          className={cn(
            "px-3.5 py-1.5 sm:px-6 text-xs font-medium flex items-center justify-between border-b transition-colors",
            isSuspended
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : (daysRemaining ?? 0) <= 2
              ? "bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30"
              : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30"
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {isSuspended ? (
              <AlertCircle className="size-3.5 shrink-0" />
            ) : (
              <Gift className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className="truncate">
              {isSuspended
                ? "Mode gratuit terminé — Compte désactivé. Contactez l'administrateur pour renouveler."
                : `Mode Gratuit : ${daysRemaining} jour${(daysRemaining ?? 0) > 1 ? "s" : ""} restant${(daysRemaining ?? 0) > 1 ? "s" : ""}`}
            </span>
          </div>
          <span className="text-[11px] opacity-80 shrink-0 ml-2 hidden sm:inline">
            {isSuspended
              ? "Accès restreint"
              : `Expire le ${new Date(merchant.subscription_expires_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
          </span>
        </div>
      )}

      <main className="flex-1 w-full max-w-[800px] mx-auto p-3.5 sm:p-6 pb-8">
        <Outlet />
      </main>
    </div>
  );
}
