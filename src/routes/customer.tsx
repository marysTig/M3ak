import { createFileRoute, Link, Outlet, useNavigate, type LinkProps } from "@tanstack/react-router";
import { Bell, Compass, Gift, QrCode, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { useAuthGuard } from "@/hooks/use-auth-guard";

export const Route = createFileRoute("/customer")({
  component: CustomerLayout,
});

const tabs: { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { to: "/customer", label: "Cartes", icon: Wallet, exact: true },
  { to: "/customer/rewards", label: "Récompenses", icon: Gift },
  { to: "/customer/scan", label: "Scanner", icon: QrCode },
  { to: "/customer/discover", label: "Découvrir", icon: Compass },
  { to: "/customer/profile", label: "Profil", icon: User },
];

function CustomerLayout() {
  const navigate = useNavigate();
  const { profile, loading } = useAuthGuard("customer");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-border bg-background sm:max-w-lg sm:border-x">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-primary">
              <img
                src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
                alt="M3ak"
                className="size-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </span>
            <span className="font-display text-sm font-semibold">M3ak</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent"
              aria-label="Notifications"
            >
              <Bell className="size-4.5" />
            </button>
            <Link
              to="/customer/profile"
              className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-xs font-semibold text-primary"
            >
              {profile?.initials ?? "?"}
            </Link>
          </div>
        </header>

        <main className="flex-1 space-y-5 px-4 pb-28 pt-5">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 z-30 w-full max-w-md border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:max-w-lg">
          <ul className="flex items-stretch justify-between">
            {tabs.map((t) => (
              <li key={String(t.to)} className="flex-1">
                <Link
                  to={t.to}
                  activeOptions={{ exact: t.exact ?? false }}
                  className="flex flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] font-medium text-muted-foreground transition-colors"
                  activeProps={{ className: "text-primary" }}
                >
                  <t.icon className="size-5" />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
