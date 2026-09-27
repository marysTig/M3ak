import { createFileRoute, Outlet, Link, useMatchRoute } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";

import { business } from "@/lib/mock-data";

export const Route = createFileRoute("/business")({
  component: BusinessLayout,
});

function BusinessLayout() {
  const matchRoute = useMatchRoute();
  const isRoot = matchRoute({ to: "/business", exact: true });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          {!isRoot ? (
            <Link to="/business" className="flex size-9 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <ArrowLeft className="size-5" />
            </Link>
          ) : (
            <Link to="/" className="flex size-9 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground transition-colors">
              <LogOut className="size-5" />
            </Link>
          )}
          <span className="font-display text-sm font-semibold">{business.name}</span>
        </div>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
          BC
        </span>
      </header>
      <main className="flex-1 w-full max-w-[800px] mx-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  );
}
