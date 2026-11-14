import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Gift,
  HelpCircle,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { HierarchicalProspectsTable } from "@/components/prospection/hierarchical-prospects-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { getProspects, updateProspect, updateProspectStatus } from "@/lib/db/prospects";
import type { Prospect, ProspectStatus } from "@/lib/types/prospection";

export const Route = createFileRoute("/prospector/")({
  head: () => ({
    meta: [
      { title: "Mes Listes Commerciales — Prospecteur M3ak" },
      { name: "description", content: "Gestion de mes commerces prospects, suivi des statuts et essais 7 jours." },
    ],
  }),
  component: ProspectorDashboardPage,
});

function ProspectorDashboardPage() {
  const { profile } = useAuthGuard("prospector");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  // Modale pour ajouter/éditer des notes
  const [noteProspect, setNoteProspect] = useState<Prospect | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function loadMyProspects() {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Charger uniquement les prospects attribués au prospecteur connecté
      const list = await getProspects({
        prospectorId: profile.id,
      });
      setProspects(list);
    } catch (err) {
      console.error("Erreur chargement listes prospecteur :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (profile?.id) {
      loadMyProspects();
    }
  }, [profile?.id]);

  // Modification du Statut (autorisé pour le prospecteur)
  const handleStatusChange = async (prospectId: string, newStatus: ProspectStatus) => {
    try {
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, status: newStatus } : p))
      );
      await updateProspectStatus(prospectId, newStatus, profile?.id);
    } catch (err: any) {
      console.error("Erreur modification statut :", err);
      alert(`Erreur : ${err?.message || "Impossible de modifier le statut."}`);
      loadMyProspects();
    }
  };

  // Enregistrer une note commerciale
  const handleSaveNotes = async () => {
    if (!noteProspect) return;
    setSavingNote(true);
    try {
      const updated = await updateProspect(noteProspect.id, {
        notes: noteText.trim() || null,
      });
      if (updated) {
        setProspects((prev) =>
          prev.map((p) => (p.id === noteProspect.id ? { ...p, notes: noteText.trim() } : p))
        );
        setNoteProspect(null);
      }
    } finally {
      setSavingNote(false);
    }
  };

  // Métriques de la vue d'ensemble demandées
  const totalAttributed = prospects.length;
  const toCallbackCount = prospects.filter((p) => p.status === "callback").length;
  const freeTrialCount = prospects.filter((p) => p.status === "trial").length;
  const rejectedCount = prospects.filter((p) => p.status === "rejected").length;
  const paidCount = prospects.filter((p) => p.finale === "paid").length;
  const unpaidCount = prospects.filter((p) => p.finale === "unpaid").length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Bienvenue, ${profile?.full_name || "Commercial"}`}
        description="Retrouvez l'ensemble des commerces qui vous sont attribués. Mettez à jour vos statuts de contact et suivez la validation finale par l'administration."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={loadMyProspects}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        }
      />

      {/* Cartes KPI requises dans les spécifications */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          label="Total attribués"
          value={totalAttributed.toString()}
          icon={Building2}
        />
        <StatCard
          label="À rappeler"
          value={toCallbackCount.toString()}
          icon={Clock}
        />
        <StatCard
          label="Essais gratuits"
          value={freeTrialCount.toString()}
          icon={Gift}
        />
        <StatCard
          label="Refusés"
          value={rejectedCount.toString()}
          icon={XCircle}
        />
        <StatCard
          label="Clients payés"
          value={paidCount.toString()}
          icon={CheckCircle2}
        />
        <StatCard
          label="Non payés"
          value={unpaidCount.toString()}
          icon={AlertCircle}
        />
      </div>

      {/* SECTION MES LISTES AVEC TABLEAU HIÉRARCHIQUE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg text-foreground">
              Mes Listes de Commerces Attribués
            </h3>
            <p className="text-xs text-muted">
              Organisées par Wilaya et Commune. Vous pouvez modifier la colonne <strong>Statut</strong>. La colonne <strong>Finale</strong> est gérée par l'administration.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-surface/50">
            <div className="flex items-center gap-2 text-muted text-sm">
              <RefreshCw className="size-5 animate-spin" />
              Chargement de vos listes...
            </div>
          </div>
        ) : (
          <HierarchicalProspectsTable
            prospects={prospects}
            canEditStatus={true} // Le prospecteur peut modifier son Statut
            canEditFinale={false} // Finale est strictement en LECTURE SEULE pour le prospecteur
            onStatusChange={handleStatusChange}
            enableSelection={false}
            showProspectorColumn={false}
            defaultHierarchical={true}
          />
        )}
      </div>

      {/* MODALE NOTES COMMERCIALES */}
      <Dialog open={!!noteProspect} onOpenChange={(open) => !open && setNoteProspect(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notes d'échange — {noteProspect?.business_name}</DialogTitle>
            <DialogDescription>
              Ajoutez vos remarques de prospection ou l'historique de votre appel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="note">Commentaire de terrain</Label>
            <Textarea
              id="note"
              placeholder="Client intéressé par la fidélité, rappeler mardi 14h..."
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteProspect(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveNotes} disabled={savingNote}>
              {savingNote ? "Enregistrement..." : "Enregistrer la note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

