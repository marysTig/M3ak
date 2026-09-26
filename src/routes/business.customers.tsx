import { createFileRoute } from "@tanstack/react-router";
import { Minus, Plus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customers, transactions, type BusinessCustomer } from "@/lib/mock-data";

export const Route = createFileRoute("/business/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Search, filter and manage loyalty customers, points balances and visit history.",
      },
      { property: "og:title", content: "Customers — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Search, filter and manage loyalty customers, points balances and visit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomersPage,
});

const filters = ["all", "active", "inactive", "new"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
}

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<BusinessCustomer | null>(null);

  const rows = useMemo(
    () =>
      customers.filter((c) => {
        const matchesFilter = filter === "all" || c.status === filter;
        const q = query.trim().toLowerCase();
        const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
        return matchesFilter && matchesQuery;
      }),
    [query, filter],
  );

  const history = selected
    ? transactions.filter((t) => t.customer === selected.name)
    : [];

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone enrolled in your loyalty program." />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Try a different search term or filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Visits</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Activity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {initials(c.name)}
                        </span>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.email}
                    </TableCell>
                    <TableCell className="text-right font-medium">{c.points}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{c.visits}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {c.lastActivity}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(c);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{selected.email}</SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-8">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{selected.points}</p>
                    <p className="text-xs text-muted-foreground">Current points</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{selected.totalEarned}</p>
                    <p className="text-xs text-muted-foreground">Total earned</p>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3 text-center">
                    <p className="font-display text-xl font-semibold">{selected.rewards}</p>
                    <p className="text-xs text-muted-foreground">Rewards</p>
                  </div>
                </div>

                <dl className="space-y-2 text-sm">
                  {[
                    ["Phone", selected.phone],
                    ["Joined", selected.joined],
                    ["Visits", String(selected.visits)],
                    ["Last activity", selected.lastActivity],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast.success(`10 points added to ${selected.name}`)}
                  >
                    <Plus className="size-4" /> Add Points
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`10 points removed from ${selected.name}`)}
                  >
                    <Minus className="size-4" /> Remove Points
                  </Button>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Transaction history</p>
                  {history.length === 0 ? (
                    <p className="rounded-lg bg-surface-muted px-3 py-4 text-center text-sm text-muted-foreground">
                      No transactions yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {history.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">{t.description}</p>
                            <p className="text-xs text-muted-foreground">{t.date}</p>
                          </div>
                          <span
                            className={
                              t.points >= 0 ? "font-medium text-success" : "font-medium text-destructive"
                            }
                          >
                            {t.points > 0 ? `+${t.points}` : t.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
