import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend,
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getMerchantStats, getMerchantGrowthSeries, getRedemptionMix } from "@/lib/db/transactions";

export const Route = createFileRoute("/business/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — M3ak Loyalty" },
      { name: "description", content: "Croissance clients, activité points et tendances des récompenses." },
      { property: "og:title", content: "Analytics — M3ak Loyalty" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

const ranges = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
];

interface Stats {
  totalCustomers: number;
  activeCustomers: number;
  pointsIssued: number;
  pointsRedeemed: number;
  rewardsRedeemed: number;
  redemptionRate: number;
}

function AnalyticsPage() {
  const [range, setRange] = useState("30d");
  const [stats, setStats] = useState<Stats | null>(null);
  const [growth, setGrowth] = useState<{ month: string; customers: number; issued: number; redeemed: number }[]>([]);
  const [mix, setMix] = useState<{ reward: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id").eq("owner_id", user.id).single();
      if (!m) return;

      const [s, g, mx] = await Promise.all([
        getMerchantStats(m.id),
        getMerchantGrowthSeries(m.id),
        getRedemptionMix(m.id),
      ]);

      setStats(s);
      setGrowth(g);
      setMix(mx);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Chargement des analytics…</div>;
  }

  const statCards = stats ? [
    { label: "Clients totaux", value: stats.totalCustomers.toLocaleString(), delta: "", hint: "Cartes créées" },
    { label: "Clients actifs", value: stats.activeCustomers.toLocaleString(), delta: "", hint: "Actifs ces 90 jours" },
    { label: "Points émis", value: stats.pointsIssued.toLocaleString(), delta: "", hint: "Total historique" },
    {
      label: "Taux d'échange",
      value: `${stats.redemptionRate}%`,
      delta: "",
      trend: "up" as const,
      hint: `${stats.rewardsRedeemed} récompenses échangées`,
    },
  ] : [];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="How your loyalty program is performing."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {ranges.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>{r.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {growth.length > 0 ? (
        <>
          <div className="card-surface p-5">
            <h2 className="font-semibold">Customer growth</h2>
            <div className="mt-6 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth}>
                  <defs>
                    <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="customers" stroke="var(--color-chart-1)"
                    strokeWidth={2.5} fill="url(#growth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h2 className="font-semibold">Points activity</h2>
              <div className="mt-6 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growth}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="issued" name="Issued" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="redeemed" name="Redeemed" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {mix.length > 0 && (
              <div className="card-surface p-5">
                <h2 className="font-semibold">Reward redemptions</h2>
                <div className="mt-6 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mix} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis type="category" dataKey="reward" tickLine={false} axisLine={false} fontSize={12} width={100} />
                      <Tooltip cursor={{ fill: "var(--color-surface-muted)" }} contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card-surface flex flex-col items-center gap-3 p-12 text-center">
          <p className="font-medium">Pas encore de données</p>
          <p className="text-sm text-muted-foreground">Les graphiques apparaîtront dès que vous aurez des clients et des transactions.</p>
        </div>
      )}
    </>
  );
}
