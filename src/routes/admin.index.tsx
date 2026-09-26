import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminActivity, adminBusinesses, adminGrowth, adminStats } from "@/lib/mock-data";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform Overview — Loyalty Admin" },
      {
        name: "description",
        content: "Network-wide view of businesses, customers, points issued and revenue.",
      },
      { property: "og:title", content: "Platform Overview — Loyalty Admin" },
      {
        property: "og:description",
        content: "Network-wide view of businesses, customers, points issued and revenue.",
      },
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

function AdminOverview() {
  const newest = adminBusinesses.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Platform overview"
        subtitle="How the loyalty network is performing this month."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {adminStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <h2 className="font-semibold">Network growth</h2>
          <p className="text-sm text-muted-foreground">Customers across all businesses</p>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={adminGrowth}>
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
                <Area
                  type="monotone"
                  dataKey="customers"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  fill="url(#net)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-semibold">Platform activity</h2>
          <ul className="mt-4 space-y-4">
            {adminActivity.map((a) => (
              <li key={a.id} className="space-y-1 border-b border-border pb-3 last:border-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {a.detail} · {a.time}
                </p>
              </li>
            ))}
          </ul>
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
              {newest.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {b.category}
                  </TableCell>
                  <TableCell className="text-right">{b.customers.toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.plan}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
