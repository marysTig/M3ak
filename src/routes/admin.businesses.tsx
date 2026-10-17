import { createFileRoute } from "@tanstack/react-router";
import { Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllMerchants, setMerchantStatus } from "@/lib/db/merchants";

const filters = ["all", "active", "pending", "suspended"] as const;

interface MerchantRow {
  id: string;
  name: string;
  category: string | null;
  owner_id: string;
  plan: string;
  status: "active" | "pending" | "suspended";
  customers: number;
  joined: string;
}

export const Route = createFileRoute("/admin/businesses")({
  head: () => ({
    meta: [
      { title: "Businesses — Loyalty Admin" },
      { name: "description", content: "Review, approve and suspend the businesses running loyalty programs." },
      { property: "og:title", content: "Businesses — Loyalty Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminBusinesses,
});

function AdminBusinesses() {
  const [rows, setRows] = useState<MerchantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");

  async function load() {
    try {
      const data = await getAllMerchants();
      const mapped = (data as (typeof data[0] & { loyalty_cards: { count: number }[] })[]).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        owner_id: m.owner_id,
        plan: m.plan,
        status: m.status,
        customers: Array.isArray(m.loyalty_cards) ? m.loyalty_cards.length : 0,
        joined: new Date(m.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
      }));
      setRows(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(b: MerchantRow) {
    try {
      await setMerchantStatus(b.id, "active");
      setRows((prev) => prev.map((r) => r.id === b.id ? { ...r, status: "active" } : r));
      toast.success(`${b.name} approuvé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  }

  async function handleSuspend(b: MerchantRow) {
    try {
      await setMerchantStatus(b.id, "suspended");
      setRows((prev) => prev.map((r) => r.id === b.id ? { ...r, status: "suspended" } : r));
      toast.success(`${b.name} suspendu`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur.");
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((b) => {
      const matchFilter = filter === "all" || b.status === filter;
      const matchQuery = !q || `${b.name} ${b.category ?? ""}`.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [rows, query, filter]);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <>
      <PageHeader title="Businesses" subtitle="Every business on the platform." />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search businesses..." className="pl-9" value={query}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f} value={f} className="capitalize">{f}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Store} title="No businesses found"
              description={rows.length === 0 ? "Aucun commerce enregistré." : "Try another search or filter."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.category}</p>
                    </TableCell>
                    <TableCell className="text-right">{b.customers.toLocaleString()}</TableCell>
                    <TableCell className="hidden sm:table-cell">{b.plan}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{b.joined}</TableCell>
                    <TableCell><StatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">Manage</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {b.status !== "active" && (
                            <DropdownMenuItem onClick={() => handleApprove(b)}>
                              Approve
                            </DropdownMenuItem>
                          )}
                          {b.status !== "suspended" && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleSuspend(b)}>
                              Suspend
                            </DropdownMenuItem>
                          )}
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
