import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { growthSeries, redemptionMix } from "@/lib/mock-data";

export const Route = createFileRoute("/business/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Customer growth, points activity and reward redemption trends for Bloom Café.",
      },
      { property: "og:title", content: "Analytics — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Customer growth, points activity and reward redemption trends for Bloom Café.",
      },
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

function AnalyticsPage() {
  const [range, setRange] = useState("30d");

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="How your loyalty program is performing."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {ranges.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Customer Growth" value="+192" delta="+17.6%" hint="New members this period" />
        <StatCard label="Points Issued" value="12,450" delta="+12.6%" hint="Across 1,284 members" />
        <StatCard label="Points Redeemed" value="3,840" delta="+8.9%" hint="186 rewards claimed" />
        <StatCard
          label="Reward Redemption Rate"
          value="30.8%"
          delta="-1.4%"
          trend="down"
          hint="Redeemed vs issued"
        />
      </div>

      <div className="card-surface p-5">
        <h2 className="font-semibold">Customer growth</h2>
        <div className="mt-6 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthSeries}>
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
              <Area
                type="monotone"
                dataKey="customers"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                fill="url(#growth)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-surface p-5">
          <h2 className="font-semibold">Points activity</h2>
          <div className="mt-6 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthSeries}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="issued"
                  name="Issued"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="redeemed"
                  name="Redeemed"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-semibold">Reward redemptions</h2>
          <div className="mt-6 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={redemptionMix} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="reward"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={100}
                />
                <Tooltip cursor={{ fill: "var(--color-surface-muted)" }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
