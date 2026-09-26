import { createFileRoute } from "@tanstack/react-router";
import { Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminBusinesses } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/businesses")({
  head: () => ({
    meta: [
      { title: "Businesses — Loyalty Admin" },
      {
        name: "description",
        content: "Review, approve and suspend the businesses running loyalty programs.",
      },
      { property: "og:title", content: "Businesses — Loyalty Admin" },
      {
        property: "og:description",
        content: "Review, approve and suspend the businesses running loyalty programs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBusinesses,
});

const filters = ["all", "active", "pending", "suspended"] as const;

function AdminBusinesses() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");

  const rows = useMemo(
    () =>
      adminBusinesses.filter((b) => {
        const q = query.trim().toLowerCase();
        return (
          (filter === "all" || b.status === filter) &&
          (!q || `${b.name} ${b.owner} ${b.category}`.toLowerCase().includes(q))
        );
      }),
    [query, filter],
  );

  return (
    <>
      <PageHeader title="Businesses" subtitle="Every business on the platform." />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search businesses..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
              icon={Store}
              title="No businesses found"
              description="Try another search or filter."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.category}</p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {b.owner}
                    </TableCell>
                    <TableCell className="text-right">{b.customers.toLocaleString()}</TableCell>
                    <TableCell className="hidden sm:table-cell">{b.plan}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {b.joined}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Manage
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.success(`${b.name} approved`)}>
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.success(`Opened ${b.name}`)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => toast.success(`${b.name} suspended`)}
                          >
                            Suspend
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
