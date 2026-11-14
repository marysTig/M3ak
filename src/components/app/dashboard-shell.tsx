import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import { Menu, LogOut, ChevronsUpDown, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type NavSubItem = {
  id: string;
  label: string;
  to: NonNullable<LinkProps["to"]>;
  search?: Record<string, any>;
  exact?: boolean;
};

export type NavItem = {
  id?: string;
  to?: NonNullable<LinkProps["to"]>;
  label: string;
  icon: LucideIcon;
  search?: Record<string, any>;
  exact?: boolean;
  children?: NavSubItem[];
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

type Profile = { name: string; sub: string; initials: string };

function NavSections({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentSearch = (location.search || {}) as Record<string, any>;

  function isSubActive(sub: { to: string; search?: Record<string, any>; exact?: boolean }) {
    const pathMatches = sub.exact
      ? currentPath === sub.to
      : currentPath === sub.to || (sub.to !== "/" && currentPath.startsWith(`${sub.to}/`));
    if (!pathMatches) return false;

    if (!sub.search || Object.keys(sub.search).length === 0) {
      return (
        !currentSearch.view &&
        !currentSearch.tab &&
        !currentSearch.filter &&
        !currentSearch.section &&
        !currentSearch.action
      );
    }

    return Object.entries(sub.search).every(([k, v]) => String(currentSearch[k]) === String(v));
  }

  function isGroupActive(group: NavItem) {
    if (group.children && group.children.length > 0) {
      return group.children.some(isSubActive);
    }
    if (group.to) {
      return isSubActive({ to: group.to, search: group.search, exact: group.exact });
    }
    return false;
  }

  // État d'ouverture/fermeture des catégories avec persistance locale
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("m3ak_admin_nav_groups") : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return { prospection: true };
  });

  // Garder ouvert automatiquement le groupe contenant la page active
  useEffect(() => {
    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (item.children && isGroupActive(item)) {
          const groupId = item.id || item.label;
          setOpenGroups((prev) => {
            if (prev[groupId]) return prev;
            const next = { ...prev, [groupId]: true };
            try {
              localStorage.setItem("m3ak_admin_nav_groups", JSON.stringify(next));
            } catch {}
            return next;
          });
        }
      });
    });
  }, [currentPath, currentSearch, sections]);

  function toggleGroup(groupId: string) {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem("m3ak_admin_nav_groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section, sIdx) => (
        <div key={section.title || sIdx} className="space-y-1">
          {section.title && (
            <div className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75 select-none">
              {section.title}
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const groupId = item.id || item.label;
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const hasActiveChild = isGroupActive(item);
              const isOpen = openGroups[groupId] ?? false;

              if (hasChildren && item.children) {
                return (
                  <div key={groupId} className="space-y-0.5">
                    {/* Bouton de catégorie principale dépliable */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(groupId)}
                      aria-expanded={isOpen}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-all select-none cursor-pointer",
                        hasActiveChild
                          ? "bg-sidebar-accent/80 text-sidebar-primary font-bold"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <item.icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            hasActiveChild
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ChevronDown
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-sidebar-accent-foreground",
                          isOpen && "rotate-180 text-primary"
                        )}
                      />
                    </button>

                    {/* Sous-menus imbriqués avec animation légère */}
                    <div
                      className={cn(
                        "grid transition-all duration-200 ease-in-out",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="ml-3.5 my-0.5 pl-2.5 border-l border-sidebar-border/80 flex flex-col gap-0.5">
                          {item.children.map((sub) => {
                            const active = isSubActive(sub);
                            return (
                              <Link
                                key={sub.id}
                                to={sub.to}
                                search={sub.search}
                                activeOptions={{ exact: sub.exact ?? false }}
                                onClick={onNavigate}
                                className={cn(
                                  "group/sub flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors relative",
                                  active
                                    ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                                )}
                              >
                                <span
                                  className={cn(
                                    "size-1.5 rounded-full shrink-0 transition-all",
                                    active
                                      ? "bg-primary scale-125"
                                      : "bg-muted-foreground/35 group-hover/sub:bg-muted-foreground/70"
                                  )}
                                />
                                <span className="truncate">{sub.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Catégorie directe sans sous-menus
              const isActive = isGroupActive(item);
              return (
                <Link
                  key={groupId}
                  to={item.to!}
                  search={item.search}
                  activeOptions={{ exact: item.exact ?? false }}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-bold"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <item.icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ProfileBlock({
  profile,
  onSignOut,
}: {
  profile: Profile;
  onSignOut?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            {profile.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{profile.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{profile.sub}</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="truncate">{profile.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onSignOut ? (
          <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
            <LogOut className="size-4" />
            Se déconnecter
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/">
              <LogOut className="size-4" /> Accueil
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({
  brand,
  brandSub,
  items,
  sections,
  profile,
  children,
  onSignOut,
}: {
  brand: string;
  brandSub: string;
  items?: NavItem[];
  sections?: NavSection[];
  profile: Profile;
  children: ReactNode;
  onSignOut?: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Normalisation des sections pour rétrocompatibilité
  const computedSections: NavSection[] = sections ?? (items ? [{ items }] : []);

  const sidebarInner = (
    <div className="flex h-full flex-col justify-between gap-4 p-4">
      {/* En-tête marque (fixé en haut) */}
      <div className="flex items-center gap-2.5 px-1 shrink-0 pb-2 border-b border-sidebar-border/60">
        <span className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary shadow-xs">
          <img
            src="/ChatGPT_Image_27_sept._2026__16_31_22-removebg-preview (1).png"
            alt="M3ak"
            className="size-full object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-sm font-semibold leading-tight truncate">{brand}</span>
          <span className="block text-xs text-muted-foreground truncate">{brandSub}</span>
        </span>
      </div>

      {/* Navigation scrollable pour l'arborescence complète */}
      <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
        <NavSections sections={computedSections} onNavigate={() => setOpen(false)} />
      </div>

      {/* Profil fixé en bas */}
      <div className="shrink-0 pt-2 border-t border-sidebar-border/60">
        <ProfileBlock profile={profile} {...(onSignOut ? { onSignOut } : {})} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        {sidebarInner}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/85 px-4 py-3 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              {sidebarInner}
            </SheetContent>
          </Sheet>
          <span className="font-display text-sm font-semibold">{brand}</span>
          <span className="ml-auto flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {profile.initials}
          </span>
        </header>

        <main className={cn("mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
