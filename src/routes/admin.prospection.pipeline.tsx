import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Eye,
  Gift,
  HelpCircle,
  Kanban,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  completeFollowup,
  createFollowup,
  deleteFollowup,
  getFollowups,
  rescheduleFollowup,
} from "@/lib/db/followups";
import { getProspectors } from "@/lib/db/prospectors";
import { getProspects, updateProspect, updateProspectStatus } from "@/lib/db/prospects";
import type {
  CommercialFollowup,
  FollowupPriority,
  Prospect,
  Prospector,
  ProspectStatus,
} from "@/lib/types/prospection";
import { PROSPECT_STATUS_COLORS, PROSPECT_STATUS_LABELS } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/pipeline")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "kanban",
    };
  },
  head: () => ({
    meta: [
      { title: "Suivi Commercial — Pipeline, Essais & Relances — M3ak CRM" },
      { name: "description", content: "Pipeline commercial Kanban, gestion des essais gratuits 7 jours et suivi des relances." },
    ],
  }),
  component: CommercialPipelinePage,
});

const KANBAN_COLUMNS: { id: ProspectStatus; label: string; headerColor: string; dotColor: string }[] = [
  { id: "new", label: "Nouveau", headerColor: "border-blue-500/50 bg-blue-500/5", dotColor: "bg-blue-500" },
  { id: "contacted", label: "Contacté", headerColor: "border-indigo-500/50 bg-indigo-500/5", dotColor: "bg-indigo-500" },
  { id: "interested", label: "Intéressé", headerColor: "border-cyan-500/50 bg-cyan-500/5", dotColor: "bg-cyan-500" },
  { id: "callback", label: "À rappeler", headerColor: "border-amber-500/50 bg-amber-500/5", dotColor: "bg-amber-500" },
  { id: "trial", label: "Essai 7j activé", headerColor: "border-purple-500/50 bg-purple-500/5", dotColor: "bg-purple-500" },
  { id: "converted", label: "Converti (Payé)", headerColor: "border-emerald-500/50 bg-emerald-500/5", dotColor: "bg-emerald-500" },
  { id: "rejected", label: "Refusé", headerColor: "border-rose-500/50 bg-rose-500/5", dotColor: "bg-rose-500" },
];

function CommercialPipelinePage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = (searchParams.tab as string) || "kanban";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [followups, setFollowups] = useState<CommercialFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale pour planifier une relance
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [selectedProspectForFollowup, setSelectedProspectForFollowup] = useState<Prospect | null>(null);
  const [followupDueDate, setFollowupDueDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0]
  );
  const [followupPriority, setFollowupPriority] = useState<FollowupPriority>("medium");
  const [followupNotes, setFollowupNotes] = useState("");
  const [savingFollowup, setSavingFollowup] = useState(false);

  // Modale pour activer l'essai 7 jours
  const [trialProspect, setTrialProspect] = useState<Prospect | null>(null);
  const [trialDays, setTrialDays] = useState(7);
  const [activatingTrial, setActivatingTrial] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [pList, prList, fList] = await Promise.all([
        getProspects(),
        getProspectors(),
        getFollowups(),
      ]);
      setProspects(pList);
      setProspectors(prList);
      setFollowups(fList);
    } catch (err) {
      console.error("Erreur chargement pipeline :", err);
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

  // Déplacement rapide dans le Kanban
  const handleMoveStatus = async (prospectId: string, newStatus: ProspectStatus) => {
    setProspects((prev) =>
      prev.map((p) => (p.id === prospectId ? { ...p, status: newStatus } : p))
    );
    await updateProspectStatus(prospectId, newStatus);
  };

  // Planification de relance
  const handleOpenFollowupModal = (p: Prospect) => {
    setSelectedProspectForFollowup(p);
    setFollowupNotes(`Relancer ${p.business_name} au sujet de l'offre M3ak`);
    setIsFollowupModalOpen(true);
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProspectForFollowup) return;
    setSavingFollowup(true);
    try {
      const newF = await createFollowup({
        prospect_id: selectedProspectForFollowup.id,
        prospector_id: selectedProspectForFollowup.assigned_to || undefined,
        due_date: followupDueDate,
        priority: followupPriority,
        notes: followupNotes.trim() || undefined,
      });
      if (newF) {
        setFollowups((prev) => [newF, ...prev]);
        setIsFollowupModalOpen(false);
      }
    } catch (err) {
      console.error("Erreur création relance :", err);
    } finally {
      setSavingFollowup(false);
    }
  };

  // Actions sur relances
  const handleCompleteFollowup = async (id: string) => {
    const ok = await completeFollowup(id, "Relance effectuée avec succès");
    if (ok) {
      setFollowups((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: "completed" as const } : f))
      );
    }
  };

  const handleReschedule = async (id: string) => {
    const nextDate = new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0];
    const ok = await rescheduleFollowup(id, nextDate);
    if (ok) {
      setFollowups((prev) =>
        prev.map((f) => (f.id === id ? { ...f, due_date: nextDate } : f))
      );
    }
  };

  const handleDeleteFollowup = async (id: string) => {
    if (!confirm("Supprimer ce rappel de relance ?")) return;
    const ok = await deleteFollowup(id);
    if (ok) {
      setFollowups((prev) => prev.filter((f) => f.id !== id));
    }
  };

  // Activation de l'essai 7 jours
  const handleActivateTrial = async () => {
    if (!trialProspect) return;
    setActivatingTrial(true);
    try {
      const now = new Date();
      const expiry = new Date(now.getTime() + trialDays * 86400000);
      const updated = await updateProspect(trialProspect.id, {
        status: "trial",
        trial_started_at: now.toISOString(),
        trial_expires_at: expiry.toISOString(),
      });
      if (updated) {
        setProspects((prev) => prev.map((p) => (p.id === trialProspect.id ? updated : p)));
        setTrialProspect(null);
      }
    } catch (err) {
      console.error("Erreur activation essai :", err);
    } finally {
      setActivatingTrial(false);
    }
  };

  // Conversion en client payant
  const handleConvertToPaid = async (p: Prospect) => {
    if (
      !confirm(
        `Confirmer la souscription de "${p.business_name}" ? Cela validera la conversion et générera la commission de 1 500 DA pour le prospecteur.`
      )
    )
      return;

    const updated = await updateProspect(p.id, {
      status: "converted",
      converted_at: new Date().toISOString(),
    });
    if (updated) {
      setProspects((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
    }
  };

  // Prospects en période d'essai
  const trialProspects = useMemo(() => {
    return prospects.filter((p) => p.status === "trial");
  }, [prospects]);

  // Prospects convertis
  const convertedProspects = useMemo(() => {
    return prospects.filter((p) => p.status === "converted");
  }, [prospects]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Suivi Commercial & Pipeline"
        description="Vue Kanban d'avancement des négociations, suivi rigoureux des 7 jours d'essai gratuit et gestion des relances."
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="kanban" className="gap-2">
            <Kanban className="size-4" />
            Pipeline Kanban
          </TabsTrigger>
          <TabsTrigger value="trials" className="gap-2">
            <Gift className="size-4" />
            Essais 7j ({trialProspects.length})
          </TabsTrigger>
          <TabsTrigger value="followups" className="gap-2">
            <Clock className="size-4" />
            Relances ({followups.filter((f) => f.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="converted" className="gap-2">
            <CheckCircle2 className="size-4" />
            Convertis ({convertedProspects.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: KANBAN BOARD */}
        <TabsContent value="kanban" className="space-y-4">
          <div className="overflow-x-auto pb-6">
            <div className="flex gap-4 min-w-[1300px]">
              {KANBAN_COLUMNS.map((col, colIdx) => {
                const colProspects = prospects.filter((p) => p.status === col.id);

                return (
                  <div
                    key={col.id}
                    className="w-72 shrink-0 rounded-2xl border border-border/80 bg-surface/60 flex flex-col shadow-sm backdrop-blur-sm"
                  >
                    {/* Header colonne */}
                    <div
                      className={`p-3.5 border-b rounded-t-2xl flex items-center justify-between ${col.headerColor}`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <span className={`size-2.5 rounded-full ${col.dotColor}`} />
                        <span>{col.label}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {colProspects.length}
                      </Badge>
                    </div>

                    {/* Liste des cartes */}
                    <div className="p-2.5 space-y-2.5 flex-1 max-h-[640px] overflow-y-auto">
                      {colProspects.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted">
                          Aucun prospect
                        </div>
                      ) : (
                        colProspects.map((p) => {
                          const prevCol = colIdx > 0 ? KANBAN_COLUMNS[colIdx - 1] : null;
                          const nextCol = colIdx < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIdx + 1] : null;

                          return (
                            <div
                              key={p.id}
                              className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs space-y-2.5 hover:border-primary/40 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-semibold text-sm text-foreground leading-tight">
                                  {p.business_name}
                                </h4>
                                {p.category && (
                                  <span className="text-[10px] text-muted-foreground shrink-0 bg-surface/80 px-1.5 py-0.5 rounded border border-border/50">
                                    {p.category}
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1 text-xs text-muted">
                                <div className="flex items-center gap-1.5 font-mono">
                                  <Phone className="size-3" />
                                  <span>{p.phone || "—"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="size-3 shrink-0" />
                                  <span className="truncate">{p.wilaya}{p.commune ? ` (${p.commune})` : ""}</span>
                                </div>
                              </div>

                              {/* Prospecteur assigné */}
                              <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[11px]">
                                {p.prospector ? (
                                  <span className="text-primary font-medium flex items-center gap-1">
                                    <UserCheck className="size-3" />
                                    {p.prospector.full_name.split(" ")[0]}
                                  </span>
                                ) : (
                                  <span className="text-muted italic">Non assigné</span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenFollowupModal(p)}
                                  className="text-muted hover:text-foreground text-[10px] flex items-center gap-0.5"
                                  title="Planifier une relance"
                                >
                                  <Clock className="size-3" />
                                  Relancer
                                </button>
                              </div>

                              {/* Raccourci essai 7j */}
                              {col.id === "interested" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs h-7 gap-1 border-purple-500/40 text-purple-600 hover:bg-purple-500/10"
                                  onClick={() => setTrialProspect(p)}
                                >
                                  <Gift className="size-3" />
                                  Activer essai 7j
                                </Button>
                              )}

                              {/* Raccourci converti */}
                              {col.id === "trial" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full text-xs h-7 gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                                  onClick={() => handleConvertToPaid(p)}
                                >
                                  <Check className="size-3" />
                                  Convertir en client
                                </Button>
                              )}

                              {/* Navigation rapide gauche/droite */}
                              <div className="flex items-center justify-between pt-1 text-xs">
                                {prevCol ? (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(p.id, prevCol.id)}
                                    className="p-1 rounded hover:bg-surface/80 text-muted hover:text-foreground"
                                    title={`Déplacer vers ${prevCol.label}`}
                                  >
                                    <ArrowLeft className="size-3.5" />
                                  </button>
                                ) : <div />}

                                {nextCol ? (
                                  <button
                                    type="button"
                                    onClick={() => handleMoveStatus(p.id, nextCol.id)}
                                    className="p-1 rounded hover:bg-surface/80 text-muted hover:text-foreground"
                                    title={`Déplacer vers ${nextCol.label}`}
                                  >
                                    <ArrowRight className="size-3.5" />
                                  </button>
                                ) : <div />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ESSAIS GRATUITS */}
        <TabsContent value="trials" className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Gift className="size-5 text-purple-500" />
                Commerçants en Période d'Essai Gratuit (7 Jours)
              </h3>
              <p className="text-sm text-muted">
                Suivez les jours restants avant désactivation du compte commerçant et prévenez l'équipe pour déclencher la souscription payante.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commerce</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Prospecteur</TableHead>
                    <TableHead>Début essai</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-center">Jours restants</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialProspects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted">
                        Aucun commerce en cours d'essai gratuit.
                      </TableCell>
                    </TableRow>
                  ) : (
                    trialProspects.map((p) => {
                      const expiry = p.trial_expires_at
                        ? new Date(p.trial_expires_at)
                        : new Date(Date.now() + 7 * 86400000);
                      const now = new Date();
                      const daysLeft = Math.ceil(
                        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 2;

                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold">{p.business_name}</TableCell>
                          <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                          <TableCell>
                            {p.prospector ? (
                              <Badge variant="outline" className="text-xs">
                                {p.prospector.full_name}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted">
                            {p.trial_started_at
                              ? new Date(p.trial_started_at).toLocaleDateString("fr-FR")
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted">
                            {expiry.toLocaleDateString("fr-FR")}
                          </TableCell>
                          <TableCell className="text-center">
                            {isUrgent ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-bold text-rose-600 animate-pulse">
                                <AlertTriangle className="size-3" />
                                {daysLeft <= 0 ? "Expiré" : `${daysLeft} jour(s)`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600">
                                {daysLeft} jours
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/40"
                                onClick={() => handleConvertToPaid(p)}
                              >
                                <Check className="size-3.5 mr-1" />
                                Convertir
                              </Button>
                            </div>
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

        {/* TAB 3: RELANCES COMMERCIALES */}
        <TabsContent value="followups" className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Clock className="size-5 text-amber-500" />
                  Rappels et Relances Commerciales
                </h3>
                <p className="text-sm text-muted">
                  Ne perdez aucun client : organisez les rappels téléphoniques et rendez-vous de démonstration.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commerce</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Notes & Objectif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {followups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted">
                        Aucune relance en attente.
                      </TableCell>
                    </TableRow>
                  ) : (
                    followups.map((f) => {
                      const isPast = new Date(f.due_date) < new Date() && f.status === "pending";

                      return (
                        <TableRow key={f.id} className={isPast ? "bg-rose-500/5" : ""}>
                          <TableCell>
                            <div className="font-semibold text-foreground">
                              {f.prospect?.business_name || "Prospect inconnu"}
                            </div>
                            <div className="text-xs text-muted font-mono">
                              {f.prospect?.phone}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div
                              className={`text-xs font-semibold flex items-center gap-1 ${
                                isPast ? "text-rose-600" : "text-foreground"
                              }`}
                            >
                              <Calendar className="size-3.5" />
                              {new Date(f.due_date).toLocaleDateString("fr-FR")}
                              {isPast && <span className="text-[10px] text-rose-500">(En retard)</span>}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-[11px] capitalize ${
                                f.priority === "urgent"
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                                  : f.priority === "high"
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                  : "text-muted"
                              }`}
                            >
                              {f.priority}
                            </Badge>
                          </TableCell>

                          <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                            {f.notes || "—"}
                          </TableCell>

                          <TableCell>
                            {f.status === "completed" ? (
                              <StatusBadge status="active" label="Effectuée" />
                            ) : (
                              <StatusBadge status="expired" label="En attente" />
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {f.status === "pending" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-emerald-500 hover:text-emerald-600"
                                    onClick={() => handleCompleteFollowup(f.id)}
                                    title="Marquer comme fait"
                                  >
                                    <CheckCircle2 className="size-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-amber-500 hover:text-amber-600 text-xs"
                                    onClick={() => handleReschedule(f.id)}
                                    title="Reporter de 2 jours"
                                  >
                                    +2j
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-500 hover:text-rose-600"
                                onClick={() => handleDeleteFollowup(f.id)}
                                title="Supprimer"
                              >
                                <XCircle className="size-4" />
                              </Button>
                            </div>
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

        {/* TAB 4: CLIENTS CONVERTIS */}
        <TabsContent value="converted" className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-500" />
                Clients Commerçants Convertis avec Succès
              </h3>
              <p className="text-sm text-muted">
                Liste des commerces ayant finalisé leur souscription après prospection. Chaque conversion donne lieu à une commission fixe de 1 500 DA.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commerce</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Wilaya</TableHead>
                    <TableHead>Prospecteur responsable</TableHead>
                    <TableHead>Date conversion</TableHead>
                    <TableHead className="text-right">Commission générée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convertedProspects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted">
                        Aucun commerce converti pour le moment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    convertedProspects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold">{p.business_name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                        <TableCell>{p.wilaya}</TableCell>
                        <TableCell>
                          {p.prospector ? (
                            <Badge variant="outline" className="text-xs">
                              {p.prospector.full_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted">
                          {p.converted_at
                            ? new Date(p.converted_at).toLocaleDateString("fr-FR")
                            : "Récent"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">
                          1 500 DA
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

      {/* MODALE PLANIFICATION RELANCE */}
      <Dialog open={isFollowupModalOpen} onOpenChange={setIsFollowupModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Planifier une relance commerciale</DialogTitle>
            <DialogDescription>
              Programmez un rappel pour contacter{" "}
              <strong>{selectedProspectForFollowup?.business_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFollowup} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date d'échéance du rappel *</Label>
              <Input
                id="date"
                type="date"
                value={followupDueDate}
                onChange={(e) => setFollowupDueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prio">Niveau d'urgence / Priorité</Label>
              <Select
                value={followupPriority}
                onValueChange={(v) => setFollowupPriority(v as FollowupPriority)}
              >
                <SelectTrigger id="prio">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse (Simple vérification)</SelectItem>
                  <SelectItem value="medium">Moyenne (Rappel standard)</SelectItem>
                  <SelectItem value="high">Haute (Client très intéressé)</SelectItem>
                  <SelectItem value="urgent">Urgente (Fin de période d'essai)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fnotes">Objet de la relance</Label>
              <Textarea
                id="fnotes"
                rows={3}
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFollowupModalOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={savingFollowup} className="gap-2">
                {savingFollowup ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Enregistrer le rappel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODALE ACTIVATION ESSAI 7 JOURS */}
      <Dialog open={!!trialProspect} onOpenChange={(open) => !open && setTrialProspect(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="size-5 text-purple-500" />
              Activer la période d'essai gratuit
            </DialogTitle>
            <DialogDescription>
              Vous activez un essai gratuit sans engagement pour{" "}
              <strong>{trialProspect?.business_name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4 text-xs text-purple-950 dark:text-purple-100 space-y-1">
              <div className="font-semibold">Règle de gestion M3ak :</div>
              <p>
                La période standard est de 7 jours. Une notification sera envoyée à l'administrateur
                et au prospecteur 2 jours avant l'échéance pour négocier la conversion en abonnement.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="days">Durée de l'essai (en jours)</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={30}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialProspect(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleActivateTrial}
              disabled={activatingTrial}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {activatingTrial ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Confirmer l'activation de l'essai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

