import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminCustomers } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Loyalty Admin" },
      {
        name: "description",
        content: "Global customer accounts and how many loyalty memberships each one holds.",
      },
      { property: "og:title", content: "Customers — Loyalty Admin" },
      {
        property: "og:description",
        content: "Global customer accounts and how many loyalty memberships each one holds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const [query, setQuery] = useState("");
  const rows = adminCustomers.filter((c) =>
    `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="One account per person, many loyalty memberships."
      />

      <div className="card-surface overflow-hidden">
        <div className="p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Users} title="No customers found" description="Try another search." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Memberships</TableHead>
                  <TableHead className="text-right">Total points</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {c.email}
                    </TableCell>
                    <TableCell className="text-right">{c.memberships}</TableCell>
                    <TableCell className="text-right">{c.points}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {c.joined}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
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
