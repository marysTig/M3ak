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
  phone?: string;
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

function normalizeText(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAdminCustomer(c: CustomerRow, rawQuery: string): boolean {
  const q = rawQuery.trim();
  if (!q) return true;

  const qNorm = normalizeText(q);
  const nameNorm = normalizeText(c.name);

  // 1. Recherche par nom (multi-mots et insensible aux accents)
  const qWords = qNorm.split(/\s+/).filter(Boolean);
  if (qWords.length > 0 && qWords.every((w) => nameNorm.includes(w))) {
    return true;
  }

  // 2. Recherche par numéro de téléphone
  const qDigits = q.replace(/\D/g, "");
  const phoneDigits = (c.phone || "").replace(/\D/g, "");
  if (qDigits.length >= 2 && phoneDigits.length >= 2) {
    if (phoneDigits.includes(qDigits)) return true;
    const localPhone = phoneDigits.startsWith("213") ? "0" + phoneDigits.slice(3) : phoneDigits;
    const intlPhone = phoneDigits.startsWith("0") ? "213" + phoneDigits.slice(1) : phoneDigits;
    if (localPhone.includes(qDigits) || intlPhone.includes(qDigits)) return true;
  }

  return false;
}

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

  const rows = all.filter((c) => matchesAdminCustomer(c, query));

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Clients" subtitle="Un compte par personne, plusieurs adhésions de fidélité." />

      <div className="card-surface overflow-hidden">
        <div className="p-3.5 sm:p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou numéro..." className="pl-9"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Users}
              title={all.length === 0 ? "Aucun client" : "Aucun client trouvé"}
              description={all.length === 0 ? "Les clients apparaîtront ici après leur inscription." : "Essayez une autre recherche."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 sm:px-4">Client</TableHead>
                  <TableHead className="text-right px-3 sm:px-4">Commerces</TableHead>
                  <TableHead className="text-right px-3 sm:px-4">Total points</TableHead>
                  <TableHead className="hidden lg:table-cell">Inscrit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium px-3 sm:px-4 py-3">
                      <div className="truncate max-w-[150px] sm:max-w-none">{c.name}</div>
                      {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                    </TableCell>
                    <TableCell className="text-right px-3 sm:px-4 py-3">{c.memberships}</TableCell>
                    <TableCell className="text-right px-3 sm:px-4 py-3 font-semibold text-primary">{c.totalPoints.toLocaleString()}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{c.joined}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
