import { Link, type LinkProps } from "@tanstack/react-router";
import { Menu, LogOut, ChevronsUpDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

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

export type NavItem = {
  to: LinkProps["to"];
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type Profile = { name: string; sub: string; initials: string };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <Link
          key={String(item.to)}
          to={item.to}
          activeOptions={{ exact: item.exact ?? false }}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className: "bg-sidebar-accent text-sidebar-primary",
          }}
        >
          <item.icon className="size-4.5 shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function ProfileBlock({ profile }: { profile: Profile }) {
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
        <DropdownMenuLabel>Demo account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/">
            <LogOut className="size-4" /> Exit demo
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardShell({
  brand,
  brandSub,
  items,
  profile,
  children,
}: {
  brand: string;
  brandSub: string;
  items: NavItem[];
  profile: Profile;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const sidebarInner = (
    <div className="flex h-full flex-col justify-between gap-6 p-4">
      <div className="space-y-6">
        <Link to="/" className="flex items-center gap-2.5 px-1">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
            L
          </span>
          <span>
            <span className="block font-display text-sm font-semibold leading-tight">{brand}</span>
            <span className="block text-xs text-muted-foreground">{brandSub}</span>
          </span>
        </Link>
        <NavLinks items={items} onNavigate={() => setOpen(false)} />
      </div>
      <ProfileBlock profile={profile} />
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
