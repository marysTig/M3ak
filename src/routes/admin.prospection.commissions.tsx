import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  FileCheck,
  Filter,
  History,
  Layers,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getCommissionPayouts,
  getCommissions,
  recordCommissionPayout,
  updateCommissionStatus,
} from "@/lib/db/commissions";
import { getProspectors } from "@/lib/db/prospectors";
import type { Commission, CommissionPayout, Prospector } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/commissions")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "overview",
      prospectorId: (search.prospectorId as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Commissions Commerciales — M3ak CRM" },
      { name: "description", content: "Suivi des commissions de 1 500 DA par commerçant converti et versements aux prospecteurs." },
    ],
  }),
  component: CommissionsManagementPage,
});

const PAYMENT_METHODS = [
  { id: "baridimob", label: "Baridimob (Algérie Poste)" },
  { id: "ccp", label: "Virement Compte CCP" },
  { id: "bank_transfer", label: "Virement Bancaire (RIB)" },
  { id: "cash", label: "Paiement en Espèces (Main propre)" },
  { id: "other", label: "Autre moyen de règlement" },
];

function CommissionsManagementPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = (searchParams.tab as string) || "overview";

  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [selectedProspectorId, setSelectedProspectorId] = useState<string>(
    searchParams.prospectorId || "all"
  );
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);

  // Modale de versement
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutProspectorId, setPayoutProspectorId] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState("baridimob");
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [cList, pList, prList] = await Promise.all([
        getCommissions(),
        getCommissionPayouts(),
        getProspectors(),
      ]);
      setCommissions(cList);
      setPayouts(pList);
      setProspectors(prList);
    } catch (err) {
      console.error("Erreur chargement commissions :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (val: string) => {
    navigate({
      search: (prev) => ({ ...prev, tab: val }),
    });
  };

  // Filtrage
  const pendingCommissions = useMemo(() => {
    return commissions.filter((c) => {
      const isPending = c.status === "pending" || c.status === "validated";
      const matchProspector =
        selectedProspectorId === "all" || c.prospector_id === selectedProspectorId;
      return isPending && matchProspector;
    });
  }, [commissions, selectedProspectorId]);

  // Totaux financiers
  const totalGenerated = commissions.reduce((sum, c) => sum + (c.amount_da || 1500), 0);
  const totalPending = commissions
    .filter((c) => c.status === "pending" || c.status === "validated")
    .reduce((sum, c) => sum + (c.amount_da || 1500), 0);
  const totalPaid = commissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + (c.amount_da || 1500), 0);

  // Sélection globale
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCommissions(pendingCommissions.map((c) => c.id));
    } else {
      setSelectedCommissions([]);
    }
  };

  const handleToggleOne = (id: string) => {
    setSelectedCommissions((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Ouvrir la modale de versement pour le prospecteur sélectionné
  const handleOpenPayoutModalForProspector = (prospectorId: string) => {
    setPayoutProspectorId(prospectorId);
    const related = pendingCommissions.filter((c) => c.prospector_id === prospectorId);
    setSelectedCommissions(related.map((c) => c.id));
    setPayoutReference(`VIR-${Date.now().toString().slice(-6)}`);
    setPayoutNotes(`Règlement de ${related.length} commission(s) de prospection`);
    setIsPayoutModalOpen(true);
  };

  // Enregistrer le versement réel
  const handleExecutePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutProspectorId || selectedCommissions.length === 0) return;

    setSavingPayout(true);
    try {
      const amount = selectedCommissions.length * 1500;
      const res = await recordCommissionPayout({
        prospector_id: payoutProspectorId,
        amount_da: amount,
        payment_method: payoutMethod,
        payment_reference: payoutReference.trim() || undefined,
        notes: payoutNotes.trim() || undefined,
        commission_ids: selectedCommissions,
      });

      if (res) {
        setIsPayoutModalOpen(false);
        setSelectedCommissions([]);
        loadData();
      }
    } catch (err) {
      console.error("Erreur versement :", err);
      alert("Erreur lors de l'enregistrement du versement.");
    } finally {
      setSavingPayout(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestion des Commissions"
        description="Contrôle des commissions des prospecteurs commerciaux, validation après abonnement et enregistrement des versements."
        action={
          <div className="flex items-center gap-2">
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
          </div>
        }
      />

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Commissions générées (Total)"
          value={`${totalGenerated.toLocaleString()} DA`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="À payer (En attente)"
          value={`${totalPending.toLocaleString()} DA`}
          icon={Clock}
        />
        <StatCard
          label="Total versé aux commerciaux"
          value={`${totalPaid.toLocaleString()} DA`}
          icon={ShieldCheck}
        />
      </div>

      {/* Règle de gestion légale M3ak */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-emerald-950 dark:text-emerald-100">
            <h4 className="font-bold">Règle de commission M3ak : 1 500 DA fixe</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              La commission de 1 500 DA est due au prospecteur uniquement lorsqu'un commerçant prospect
              souscrit et règle son premier abonnement mensuel ou annuel, une fois la période d'essai de 7
              jours terminée avec succès.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="gap-2">
            <CircleDollarSign className="size-4" />
            Vue générale
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Wallet className="size-4" />
            À payer ({pendingCommissions.length})
          </TabsTrigger>
          <TabsTrigger value="payouts" className="gap-2">
            <History className="size-4" />
            Historique ({payouts.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: VUE GÉNÉRALE */}
        <TabsContent value="overview" className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Users className="size-5 text-primary" />
              Solde des Commissions par Prospecteur
            </h3>
            <p className="text-sm text-muted">
              Visualisez instantanément qui a des commissions à percevoir et déclenchez leur versement.
            </p>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospecteur</TableHead>
                    <TableHead>Wilaya</TableHead>
                    <TableHead className="text-center">Commerces convertis</TableHead>
                    <TableHead className="text-right">En attente de paiement</TableHead>
                    <TableHead className="text-right">Déjà versé</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted">
                        Aucun prospecteur enregistré.
                      </TableCell>
                    </TableRow>
                  ) : (
                    prospectors.map((p) => {
                      const userPending = commissions
                        .filter(
                          (c) =>
                            c.prospector_id === p.id &&
                            (c.status === "pending" || c.status === "validated")
                        )
                        .reduce((sum, c) => sum + (c.amount_da || 1500), 0);

                      const userPaid = commissions
                        .filter((c) => c.prospector_id === p.id && c.status === "paid")
                        .reduce((sum, c) => sum + (c.amount_da || 1500), 0);

                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-semibold text-foreground">{p.full_name}</div>
                            <div className="text-xs text-muted font-mono">{p.phone}</div>
                          </TableCell>

                          <TableCell>{p.wilaya || "Algérie"}</TableCell>

                          <TableCell className="text-center font-bold text-foreground">
                            {p.conversions_count || 0}
                          </TableCell>

                          <TableCell className="text-right font-bold text-amber-500">
                            {userPending > 0 ? `${userPending.toLocaleString()} DA` : "0 DA"}
                          </TableCell>

                          <TableCell className="text-right font-bold text-emerald-600">
                            {userPaid > 0 ? `${userPaid.toLocaleString()} DA` : "0 DA"}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              disabled={userPending === 0}
                              onClick={() => handleOpenPayoutModalForProspector(p.id)}
                              className="gap-1.5 text-xs"
                            >
                              <CreditCard className="size-3.5" />
                              Payer ({userPending.toLocaleString()} DA)
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: COMMISSIONS À PAYER */}
        <TabsContent value="pending" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold">
              {pendingCommissions.length} commission(s) en attente de versement
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedProspectorId} onValueChange={setSelectedProspectorId}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Tous prospecteurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les prospecteurs</SelectItem>
                  {prospectors.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedCommissions.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const firstId = pendingCommissions.find((c) =>
                      selectedCommissions.includes(c.id)
                    )?.prospector_id;
                    if (firstId) handleOpenPayoutModalForProspector(firstId);
                  }}
                  className="gap-1.5"
                >
                  <Receipt className="size-4" />
                  Régler la sélection ({selectedCommissions.length * 1500} DA)
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-surface/90">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        pendingCommissions.length > 0 &&
                        selectedCommissions.length === pendingCommissions.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Prospecteur</TableHead>
                  <TableHead>Commerce converti</TableHead>
                  <TableHead>Date d'abonnement</TableHead>
                  <TableHead>Montant client</TableHead>
                  <TableHead className="text-right">Commission fixe</TableHead>
                  <TableHead className="text-right">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted">
                      Chargement des commissions...
                    </TableCell>
                  </TableRow>
                ) : pendingCommissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted">
                      Aucune commission en attente de paiement.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingCommissions.map((c) => {
                    const isSelected = selectedCommissions.includes(c.id);
                    return (
                      <TableRow key={c.id} className={isSelected ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleOne(c.id)}
                          />
                        </TableCell>

                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {c.prospector?.full_name || "Commercial"}
                          </div>
                          <div className="text-xs text-muted">{c.prospector?.wilaya || "Algérie"}</div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-foreground">
                            {c.merchant?.business_name || c.prospect?.business_name || "Commerce"}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("fr-FR") : "—"}
                        </TableCell>

                        <TableCell className="text-xs font-mono text-muted">
                          {c.subscription_amount_da
                            ? `${c.subscription_amount_da.toLocaleString()} DA`
                            : "Abonnement standard"}
                        </TableCell>

                        <TableCell className="text-right font-bold text-foreground">
                          {(c.amount_da || 1500).toLocaleString()} DA
                        </TableCell>

                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
                            À payer
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 3: HISTORIQUE DES PAIEMENTS */}
        <TabsContent value="payouts" className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <History className="size-5 text-emerald-500" />
                Historique des Règlements Effectués
              </h3>
              <p className="text-sm text-muted">
                Traçabilité comptable complète des virements et versements effectués aux commerciaux de terrain.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date du versement</TableHead>
                    <TableHead>Prospecteur</TableHead>
                    <TableHead>Mode de règlement</TableHead>
                    <TableHead>Référence / Reçu</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Montant versé</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted">
                        Aucun versement enregistré pour le moment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs font-semibold text-foreground">
                          {new Date(p.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>

                        <TableCell className="font-semibold">
                          {p.prospector?.full_name || "Commercial"}
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {p.payment_method}
                          </Badge>
                        </TableCell>

                        <TableCell className="font-mono text-xs text-muted">
                          {p.payment_reference || "—"}
                        </TableCell>

                        <TableCell className="text-xs text-muted max-w-xs truncate">
                          {p.notes || "—"}
                        </TableCell>

                        <TableCell className="text-right font-bold text-emerald-600">
                          {p.amount_da.toLocaleString()} DA
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODALE D'ENREGISTREMENT DE VERSEMENT */}
      <Dialog open={isPayoutModalOpen} onOpenChange={setIsPayoutModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-emerald-500" />
              Enregistrer un versement de commissions
            </DialogTitle>
            <DialogDescription>
              Enregistrez le virement pour le commercial sélectionné et clôturez les commissions associées.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleExecutePayout} className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-1">
              <div className="text-xs text-muted">Montant total calculé :</div>
              <div className="text-2xl font-bold text-emerald-600">
                {(selectedCommissions.length * 1500).toLocaleString()} DA
              </div>
              <div className="text-xs text-muted">
                Correspondant à {selectedCommissions.length} commission(s) de 1 500 DA.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="method">Mode de règlement *</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref">Numéro de transaction / Référence reçu</Label>
              <Input
                id="ref"
                placeholder="Ex: BARIDI-987654321"
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pnotes">Commentaires ou justificatif</Label>
              <Textarea
                id="pnotes"
                placeholder="Virement effectué via application Baridimob..."
                rows={2}
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPayoutModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={savingPayout} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                {savingPayout ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Confirmer et valider le paiement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

