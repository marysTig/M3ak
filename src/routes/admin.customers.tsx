import { createFileRoute } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllCustomers } from "@/lib/db/customers";

interface CustomerRow {
  id: string;
  name: string;
  memberships: number;
  totalPoints: number;
  joined: string;
}

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Loyalty Admin" },
      { name: "description", content: "Global customer accounts and how many loyalty memberships each one holds." },
      { property: "og:title", content: "Customers — Loyalty Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminCustomers,
});

function AdminCustomers() {
  const [all, setAll] = useState<CustomerRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllCustomers()
      .then((data) => setAll(data as CustomerRow[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const rows = all.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <PageHeader title="Customers" subtitle="One account per person, many loyalty memberships." />

      <div className="card-surface overflow-hidden">
        <div className="p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search customers..." className="pl-9"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title={all.length === 0 ? "Aucun client" : "No customers found"}
              description={all.length === 0 ? "Les clients apparaîtront ici après leur inscription." : "Try another search."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Memberships</TableHead>
                  <TableHead className="text-right">Total points</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.memberships}</TableCell>
                    <TableCell className="text-right">{c.totalPoints.toLocaleString()}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{c.joined}</TableCell>
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
