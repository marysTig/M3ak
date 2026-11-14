import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Gift,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import { getProspectionKPIs, getProspects } from "@/lib/db/prospects";
import { getCommissions } from "@/lib/db/commissions";
import { getProspectors } from "@/lib/db/prospectors";
import type { Commission, Prospect, Prospector, ProspectionKPIs } from "@/lib/types/prospection";
import { PROSPECT_STATUS_COLORS, PROSPECT_STATUS_LABELS } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Vue d'ensemble Prospection — M3ak CRM" },
      { name: "description", content: "Tableau de bord commercial, conversions et suivi des prospecteurs." },
    ],
  }),
  component: ProspectionOverviewPage,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#6366f1", "#10b981", "#ef4444"];

function ProspectionOverviewPage() {
  const [kpis, setKpis] = useState<ProspectionKPIs | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [k, pList, prList, cList] = await Promise.all([
          getProspectionKPIs(),
          getProspects(),
          getProspectors(),
          getCommissions({ status: "pending" }),
        ]);
        setKpis(k);
        setProspects(pList);
        setProspectors(prList);
        setCommissions(cList);
      } catch (err) {
        console.error("Erreur chargement overview prospection :", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Calcul répartition des statuts pour le graphique Pie
  const statusCounts: Record<string, number> = {};
  prospects.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  const pieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: PROSPECT_STATUS_LABELS[status as keyof typeof PROSPECT_STATUS_LABELS] || status,
    value: count,
  }));

  // Performances par prospecteur pour BarChart
  const performanceData = prospectors.map((pr) => ({
    name: pr.full_name.split(" ")[0] || pr.full_name,
    attribues: pr.assigned_count || 0,
    convertis: pr.converted_count || 0,
    essais: pr.trial_count || 0,
  }));

  // Essais gratuits arrivant à expiration (≤ 2 jours)
  const now = Date.now();
  const expiringTrials = prospects
    .filter((p) => p.status === "trial" && p.trial_expires_at)
    .map((p) => {
      const expTime = new Date(p.trial_expires_at!).getTime();
      const days = Math.ceil((expTime - now) / (1000 * 60 * 60 * 24));
      return { ...p, daysLeft: days };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Prospection — Vue d'ensemble"
        subtitle="Performance commerciale, conversions des commerces et suivi des prospecteurs M3ak."
      />

      {/* Cartes KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Prospects Enregistrés"
          value={kpis?.totalProspects.toLocaleString() ?? "0"}
          hint={`${kpis?.newProspects ?? 0} nouveaux à contacter`}
        />
        <StatCard
          label="Essais Gratuits (7j)"
          value={kpis?.trialsActive.toLocaleString() ?? "0"}
          hint="En phase de test actif"
        />
        <StatCard
          label="Clients Convertis"
          value={kpis?.convertedTotal.toLocaleString() ?? "0"}
          hint={`Taux de conversion : ${kpis?.conversionRate ?? 0}%`}
        />
        <StatCard
          label="Commissions en Attente"
          value={`${(kpis?.totalCommissionsDue ?? 0).toLocaleString()} DA`}
          hint="1 500 DA par conversion confirmée"
        />
      </div>

      {/* Graphiques */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Graphique de performances par commercial */}
        <div className="card-surface p-5 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" />
                Performance des prospecteurs
              </h2>
              <p className="text-xs text-muted-foreground">Prospects attribués vs Essais démarrés vs Convertis</p>
            </div>
            <Link
              to="/admin/prospection/team"
              search={{ tab: "perf" }}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              Détails équipe <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="h-[250px] w-full">
            {performanceData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Aucun prospecteur enregistré pour le moment.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="attribues" name="Attribués" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="essais" name="Essais 7j" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="convertis" name="Convertis" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Graphique répartition des statuts */}
        <div className="card-surface p-5 space-y-3">
          <h2 className="font-semibold text-sm sm:text-base flex items-center gap-2">
            <Target className="size-4 text-primary" />
            Répartition du Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">Statut actuel des commerces ciblés</p>

          <div className="h-[200px] w-full flex items-center justify-center">
            {pieData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun prospect dans le CRM</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px] pt-1">
            {pieData.slice(0, 6).map((item, idx) => (
              <div key={item.name} className="flex items-center gap-1.5 truncate">
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                <span className="truncate text-muted-foreground">{item.name}</span>
                <span className="font-bold ml-auto text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deux tableaux d'alerte et d'activité : Essais expirant & Commissions à valider */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Essais gratuits expirant bientôt */}
        <div className="card-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="size-4 text-amber-500" />
              <h3 className="font-bold text-sm">Essais gratuits à relancer (≤ 2 jours)</h3>
            </div>
            <Link
              to="/admin/prospection/pipeline"
              search={{ tab: "trials" }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Voir tous ({kpis?.trialsActive ?? 0}) →
            </Link>
          </div>

          {expiringTrials.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              Aucun essai gratuit n'arrive à expiration dans les 2 prochains jours.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commerce</TableHead>
                    <TableHead>Wilaya</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiringTrials.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-semibold text-xs text-foreground">{p.business_name}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{p.phone}</p>
                      </TableCell>
                      <TableCell className="text-xs">{p.wilaya}</TableCell>
                      <TableCell>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          {p.daysLeft <= 0 ? "Expire aujourd'hui" : `${p.daysLeft} jour${p.daysLeft > 1 ? "s" : ""}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to="/admin/prospection/pipeline"
                          search={{ tab: "trials" }}
                          className="inline-flex h-7 items-center justify-center rounded-lg bg-primary/10 px-2 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          Relancer
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Commissions en attente */}
        <div className="card-surface p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="size-4 text-emerald-600" />
              <h3 className="font-bold text-sm">Commissions à verser aux prospecteurs</h3>
            </div>
            <Link
              to="/admin/prospection/commissions"
              search={{ tab: "pending" }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Gérer ({commissions.length}) →
            </Link>
          </div>

          {commissions.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
              Aucune commission en attente de paiement.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospecteur</TableHead>
                    <TableHead>Commerce converti</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead className="text-right">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.slice(0, 5).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-semibold">{c.prospector_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.prospect_name || c.merchant_name || "Abonnement"}</TableCell>
                      <TableCell className="text-xs font-bold text-emerald-600">
                        {c.amount.toLocaleString()} DA
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          À payer
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

