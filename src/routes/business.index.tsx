import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, Sparkles, UserPlus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businessStats, business, customers, recentActivity, weeklyActivity } from "@/lib/mock-data";
import { useState } from "react";

export const Route = createFileRoute("/business/")({
  head: () => ({
    meta: [
      { title: "Business Overview — Bloom Café Rewards" },
      {
        name: "description",
        content: "Daily loyalty dashboard for Bloom Café: customers, points issued and redemptions.",
      },
      { property: "og:title", content: "Business Overview — Bloom Café Rewards" },
      {
        property: "og:description",
        content: "Daily loyalty dashboard for Bloom Café: customers, points issued and redemptions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

const activityIcon = {
  earned: Sparkles,
  redeemed: Gift,
  joined: UserPlus,
} as const;

function Overview() {
  const [metric, setMetric] = useState<"visits" | "points">("visits");
  const top = [...customers].sort((a, b) => b.points - a.points).slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Good morning, ${business.name}`}
        subtitle="Here's what's happening with your loyalty program."
        actions={
          <Select defaultValue="month">
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {businessStats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Customer activity</h2>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
            <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
              <TabsList>
                <TabsTrigger value="visits">Visits</TabsTrigger>
                <TabsTrigger value="points">Points</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="mt-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              {metric === "visits" ? (
                <BarChart data={weeklyActivity}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                  <Tooltip
                    cursor={{ fill: "var(--color-surface-muted)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                  />
                  <Bar dataKey="visits" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={weeklyActivity}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-surface p-5">
          <h2 className="font-semibold">Recent activity</h2>
          <ul className="mt-4 space-y-4">
            {recentActivity.map((a) => {
              const Icon = activityIcon[a.type as keyof typeof activityIcon] ?? Sparkles;
              return (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{a.name}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5">
          <h2 className="font-semibold">Top customers</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/business/customers">
              View all customers <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Visits</TableHead>
                <TableHead className="text-right">Rewards</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                        {c.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{c.points}</TableCell>
                  <TableCell className="text-right">{c.visits}</TableCell>
                  <TableCell className="text-right">{c.rewards}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
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
