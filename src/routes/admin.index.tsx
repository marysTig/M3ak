import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { getAllMerchants } from "@/lib/db/merchants";
import { getAdminStats } from "@/lib/db/transactions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform Overview — Loyalty Admin" },
      { name: "description", content: "Network-wide view of businesses, customers, points issued and revenue." },
      { property: "og:title", content: "Platform Overview — Loyalty Admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminOverview,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

interface MerchantRow {
  id: string;
  name: string;
  category: string | null;
  plan: string;
  status: "active" | "pending" | "suspended";
  customers: number;
}

function AdminOverview() {
  const [stats, setStats] = useState({ businesses: 0, customers: 0, pointsIssued: 0 });
  const [merchants, setMerchants] = useState<MerchantRow[]>([]);
  const [growth, setGrowth] = useState<{ month: string; customers: number }[]>([]);
  const [activity, setActivity] = useState<{ id: string; title: string; detail: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, allMerchants] = await Promise.all([
          getAdminStats(),
          getAllMerchants(),
        ]);
        setStats(s);

        // Construire les lignes marchands
        const rows: MerchantRow[] = (allMerchants as (typeof allMerchants[0] & { loyalty_cards: { count: number }[] })[]).map((m) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          plan: m.plan,
          status: m.status,
          customers: Array.isArray(m.loyalty_cards) ? m.loyalty_cards.length : 0,
        }));
        setMerchants(rows.slice(0, 5));

        // Croissance réseau (6 derniers mois) — depuis loyalty_cards
        const growthData: { month: string; customers: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString();
          const label = d.toLocaleDateString("fr-FR", { month: "short" });
          const { count } = await supabase
            .from("loyalty_cards")
            .select("*", { count: "exact", head: true })
            .lte("created_at", end);
          growthData.push({ month: label, customers: count ?? 0 });
        }
        setGrowth(growthData);

        // Activité récente — dernières transactions
        const { data: recentTx } = await supabase
          .from("transactions")
          .select("id, description, created_at, merchants!transactions_merchant_id_fkey(name)")
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentTx) {
          setActivity(recentTx.map((t) => {
            const merchant = Array.isArray(t.merchants) ? t.merchants[0] : t.merchants as { name: string } | null;
            return {
              id: t.id,
              title: t.description,
              detail: merchant?.name ?? "—",
              time: new Date(t.created_at).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            };
          }));
        }
      } catch (err) {
        console.error("Admin overview error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement…</div>;
  }

  const statCards = [
    { label: "Businesses", value: stats.businesses.toLocaleString(), delta: "", hint: "Actifs et en attente" },
    { label: "Customers", value: stats.customers.toLocaleString(), delta: "", hint: "Comptes clients" },
    { label: "Points émis", value: stats.pointsIssued.toLocaleString(), delta: "", hint: "Total historique" },
    { label: "Revenu MRR", value: "—", delta: "", hint: "À configurer" },
  ];

  return (
    <>
      <PageHeader
        title="Platform overview"
        subtitle="How the loyalty network is performing this month."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <h2 className="font-semibold">Network growth</h2>
          <p className="text-sm text-muted-foreground">Customers across all businesses</p>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={52} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="customers" stroke="var(--color-chart-1)"
                  strokeWidth={2.5} fill="url(#net)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-semibold">Platform activity</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Aucune activité récente.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {activity.map((a) => (
                <li key={a.id} className="space-y-1 border-b border-border pb-3 last:border-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.detail} · {a.time}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5">
          <h2 className="font-semibold">Businesses</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/businesses">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="hidden md:table-cell">Plan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {merchants.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{b.category}</TableCell>
                  <TableCell className="text-right">{b.customers.toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.plan}</TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
