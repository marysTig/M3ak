import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  CircleDollarSign,
  Download,
  Filter,
  Layers,
  MapPin,
  PieChart as PieChartIcon,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCommissions } from "@/lib/db/commissions";
import { getProspectors } from "@/lib/db/prospectors";
import { getProspects } from "@/lib/db/prospects";
import type { Commission, Prospect, Prospector } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/reports")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Rapports & Statistiques Prospection — M3ak CRM" },
      { name: "description", content: "Analyses commerciales, entonnoir de conversion et performances régionales." },
    ],
  }),
  component: ProspectionReportsPage,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#6366f1", "#10b981", "#ef4444"];

function ProspectionReportsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const [pList, prList, cList] = await Promise.all([
        getProspects(),
        getProspectors(),
        getCommissions(),
      ]);
      setProspects(pList);
      setProspectors(prList);
      setCommissions(cList);
    } catch (err) {
      console.error("Erreur chargement rapports :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Métriques globales
  const totalLeads = prospects.length;
  const contactedLeads = prospects.filter((p) => p.status !== "new").length;
  const trialsCount = prospects.filter((p) => p.status === "trial" || p.status === "converted").length;
  const convertedCount = prospects.filter((p) => p.status === "converted").length;
  const totalCommissions = commissions.reduce((sum, c) => sum + (c.amount_da || 1500), 0);

  const conversionRate = totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : "0";
  const trialToPaidRate = trialsCount > 0 ? ((convertedCount / trialsCount) * 100).toFixed(1) : "0";

  // Entonnoir de conversion (Funnel)
  const funnelData = [
    { step: "1. Nouveaux prospects", count: totalLeads, fill: "#3b82f6" },
    { step: "2. Contactés / Intéressés", count: contactedLeads, fill: "#8b5cf6" },
    { step: "3. Essais 7 jours activés", count: trialsCount, fill: "#f59e0b" },
    { step: "4. Commerces convertis", count: convertedCount, fill: "#10b981" },
  ];

  // Données par Wilaya
  const wilayaStats = useMemo(() => {
    const stats: Record<string, { total: number; trials: number; converted: number }> = {};
    prospects.forEach((p) => {
      const w = p.wilaya || "Non spécifiée";
      if (!stats[w]) stats[w] = { total: 0, trials: 0, converted: 0 };
      stats[w].total++;
      if (p.status === "trial" || p.status === "converted") stats[w].trials++;
      if (p.status === "converted") stats[w].converted++;
    });

    return Object.entries(stats)
      .map(([wilaya, data]) => ({
        wilaya,
        ...data,
        rate: data.total > 0 ? ((data.converted / data.total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [prospects]);

  // Données par Prospecteur
  const prospectorChartData = useMemo(() => {
    return prospectors
      .map((pr) => ({
        name: pr.full_name.split(" ")[0],
        prospects: pr.assigned_count || 0,
        conversions: pr.conversions_count || 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 8);
  }, [prospectors]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Rapports & Statistiques Commerciales"
        description="Analytique décisionnelle des campagnes de prospection terrain, ratios de conversion et pénétration géographique."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        }
      />

      {/* Cartes KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Prospects dans la base"
          value={totalLeads.toLocaleString()}
          icon={Users}
        />
        <StatCard
          label="Taux de conversion global"
          value={`${conversionRate}%`}
          icon={TrendingUp}
        />
        <StatCard
          label="Transformation Essai -> Payant"
          value={`${trialToPaidRate}%`}
          icon={Award}
        />
        <StatCard
          label="Commissions totales"
          value={`${totalCommissions.toLocaleString()} DA`}
          icon={CircleDollarSign}
        />
      </div>

      {/* SECTION GRAPHIQUES */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Entonnoir de conversion */}
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Entonnoir de Conversion Commercial
            </h3>
            <p className="text-sm text-muted">
              Déperdition des prospects entre le premier contact et l'abonnement payant.
            </p>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={funnelData}
                margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-muted)" tickLine={false} />
                <YAxis
                  dataKey="step"
                  type="category"
                  stroke="var(--color-muted)"
                  tickLine={false}
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ventes par prospecteur */}
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <UserCheck className="size-5 text-emerald-500" />
              Conversions par Prospecteur
            </h3>
            <p className="text-sm text-muted">
              Nombre de ventes conclues par rapport aux prospects confiés.
            </p>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prospectorChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted)" tickLine={false} />
                <YAxis stroke="var(--color-muted)" tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="prospects" fill="#3b82f6" name="Prospects" radius={[4, 4, 0, 0]} />
                <Bar dataKey="conversions" fill="#10b981" name="Conversions" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABLEAU ANALYTIQUE PAR WILAYA */}
      <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="size-5 text-indigo-500" />
            Performance Commerciale par Wilaya (Top 10)
          </h3>
          <p className="text-sm text-muted">
            Identification des zones géographiques les plus réceptives à l'application M3ak.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wilaya</TableHead>
                <TableHead className="text-center">Total prospects</TableHead>
                <TableHead className="text-center">Essais 7j lancés</TableHead>
                <TableHead className="text-center">Abonnements payants</TableHead>
                <TableHead className="text-right">Taux de conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wilayaStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-muted">
                    Aucune donnée géographique disponible.
                  </TableCell>
                </TableRow>
              ) : (
                wilayaStats.map((row) => (
                  <TableRow key={row.wilaya}>
                    <TableCell className="font-semibold text-foreground">{row.wilaya}</TableCell>
                    <TableCell className="text-center">{row.total}</TableCell>
                    <TableCell className="text-center text-purple-600 font-medium">
                      {row.trials}
                    </TableCell>
                    <TableCell className="text-center text-emerald-600 font-bold">
                      {row.converted}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {row.rate}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

