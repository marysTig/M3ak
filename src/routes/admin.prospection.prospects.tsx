import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  FileSpreadsheet,
  FileUp,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { HierarchicalProspectsTable } from "@/components/prospection/hierarchical-prospects-table";
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
import { ALGERIA_WILAYAS } from "@/lib/constants/algeria-wilayas";
import { getProspectors } from "@/lib/db/prospectors";
import {
  assignProspects,
  createProspect,
  deleteProspect,
  getProspects,
  importAndAssignExcelProspects,
  updateProspectFinale,
  updateProspectStatus,
} from "@/lib/db/prospects";
import type { ExcelParseResult, ParsedProspectRow } from "@/lib/excel-parser";
import { parseProspectsExcelFile } from "@/lib/excel-parser";
import type { Prospect, ProspectFinale, Prospector, ProspectStatus } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/prospects")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "all",
      status: (search.status as string) || undefined,
      finale: (search.finale as string) || undefined,
      wilaya: (search.wilaya as string) || undefined,
      prospectorId: (search.prospectorId as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Gestion des Prospects & CRM — M3ak" },
      { name: "description", content: "Tableau hiérarchique, import Excel (.xlsx) et attribution des listes." },
    ],
  }),
  component: ProspectsManagementPage,
});

function ProspectsManagementPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = (searchParams.tab as string) || "all";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [loading, setLoading] = useState(true);

  // Sélections multiples
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modale Nouveau Prospect
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formBusinessName, setFormBusinessName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWilaya, setFormWilaya] = useState("Alger");
  const [formCommune, setFormCommune] = useState("");
  const [formCategory, setFormCategory] = useState("Restaurant / Café");
  const [formStatus, setFormStatus] = useState<ProspectStatus>("callback");
  const [formFinale, setFormFinale] = useState<ProspectFinale>(null);
  const [formAssignedTo, setFormAssignedTo] = useState<string>("unassigned");
  const [formNotes, setFormNotes] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  // Modale Attribution de la sélection existante
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetProspectorId, setTargetProspectorId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // ─── WORKFLOW IMPORT & ATTRIBUTION EXCEL ───
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [excelStep, setExcelStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [targetImportProspectorId, setTargetImportProspectorId] = useState<string>("");
  const [committingImport, setCommittingImport] = useState(false);
  const [importReport, setImportReport] = useState<{
    inserted: number;
    duplicates: number;
    rejected: number;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [pList, prList] = await Promise.all([
        getProspects({
          status: searchParams.status,
          finale: searchParams.finale,
          wilaya: searchParams.wilaya,
          prospectorId: searchParams.prospectorId,
        }),
        getProspectors(),
      ]);
      setProspects(pList);
      setProspectors(prList);
    } catch (err) {
      console.error("Erreur chargement prospects :", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [searchParams.status, searchParams.finale, searchParams.wilaya, searchParams.prospectorId]);

  const handleTabChange = (val: string) => {
    navigate({
      search: (prev) => ({ ...prev, tab: val }),
    });
  };

  // Modification directe de Finale (ADMIN SEULEMENT)
  const handleAdminChangeFinale = async (prospectId: string, newFinale: ProspectFinale) => {
    try {
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, finale: newFinale } : p))
      );
      await updateProspectFinale(prospectId, newFinale);
    } catch (err) {
      console.error("Erreur mise à jour Finale :", err);
      alert("Erreur lors de la mise à jour de la colonne Finale.");
      loadData();
    }
  };

  // Modification directe du Statut
  const handleStatusChange = async (prospectId: string, newStatus: ProspectStatus) => {
    try {
      setProspects((prev) =>
        prev.map((p) => (p.id === prospectId ? { ...p, status: newStatus } : p))
      );
      await updateProspectStatus(prospectId, newStatus);
    } catch (err) {
      console.error("Erreur mise à jour Statut :", err);
      loadData();
    }
  };

  // Création manuelle d'un prospect
  const handleCreateProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBusinessName.trim() || !formPhone.trim()) {
      alert("Le nom et le numéro de téléphone sont obligatoires.");
      return;
    }

    setSavingForm(true);
    try {
      const created = await createProspect({
        business_name: formBusinessName.trim(),
        phone: formPhone.trim(),
        wilaya: formWilaya,
        commune: formCommune.trim() || undefined,
        category: formCategory,
        status: formStatus,
        finale: formFinale,
        assigned_to: formAssignedTo === "unassigned" ? null : formAssignedTo,
        notes: formNotes.trim() || undefined,
      });

      if (created) {
        setProspects((prev) => [created, ...prev]);
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Erreur création prospect :", err);
    } finally {
      setSavingForm(false);
    }
  };

  // Attribution groupée de la sélection existante
  const handleExecuteBatchAssign = async () => {
    if (!targetProspectorId || selectedIds.length === 0) return;
    setAssigning(true);
    try {
      const ok = await assignProspects(
        selectedIds,
        targetProspectorId === "unassigned" ? null : targetProspectorId
      );
      if (ok) {
        const assignedProspector = prospectors.find((pr) => pr.id === targetProspectorId);
        setProspects((prev) =>
          prev.map((p) =>
            selectedIds.includes(p.id)
              ? {
                  ...p,
                  assigned_to: targetProspectorId === "unassigned" ? null : targetProspectorId,
                  prospector: assignedProspector,
                }
              : p
          )
        );
        setSelectedIds([]);
        setIsAssignModalOpen(false);
      }
    } finally {
      setAssigning(false);
    }
  };

  // ─── GESTION DU WORKFLOW EXCEL (.XLSX) ───

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processExcelFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  };

  const processExcelFile = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Format invalide. Veuillez importer un fichier Excel (.xlsx ou .xls).");
      return;
    }

    setExcelFile(file);
    setParsing(true);
    try {
      const result = await parseProspectsExcelFile(file);
      setParseResult(result);
      setExcelStep(2); // Prévisualisation
    } catch (err: any) {
      alert(`Erreur de lecture du fichier Excel : ${err?.message}`);
    } finally {
      setParsing(false);
    }
  };

  const handleCommitExcelImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;
    setCommittingImport(true);
    try {
      const res = await importAndAssignExcelProspects({
        filename: parseResult.filename,
        assigned_to: targetImportProspectorId ? targetImportProspectorId : null,
        rows: parseResult.validRows.map((r) => ({
          business_name: r.business_name,
          wilaya: r.wilaya,
          commune: r.commune,
          phone: r.phone,
          category: r.category,
          status: r.status,
          finale: r.finale,
        })),
      });

      setImportReport({
        inserted: res.insertedCount,
        duplicates: res.duplicateCount,
        rejected: res.rejectedCount + parseResult.invalidRows.length,
      });

      setExcelStep(5); // Résumé final
      loadData();
    } catch (err: any) {
      alert(`Erreur lors de l'enregistrement dans Supabase : ${err?.message}`);
    } finally {
      setCommittingImport(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestion des Prospects"
        description="Fichier centralisé des commerces, importation exclusive par fichier Excel (.xlsx) et attribution des listes."
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleTabChange("import")}
              className="gap-2"
            >
              <FileSpreadsheet className="size-4" />
              Importer un fichier Excel
            </Button>
            <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
              <Plus className="size-4" />
              Nouveau prospect
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="all" className="gap-2">
            <Building2 className="size-4" />
            Tous les commerces ({prospects.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <FileSpreadsheet className="size-4" />
            Importer & Attribuer (Excel)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TOUS LES COMMERCES AVEC TABLEAU HIÉRARCHIQUE */}
        <TabsContent value="all" className="space-y-4">
          {/* Action groupée si sélection */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 font-medium text-primary">
                <CheckCircle2 className="size-4" />
                {selectedIds.length} commerce(s) sélectionné(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="gap-1.5 bg-surface text-xs"
                >
                  <UserCheck className="size-3.5" />
                  Attribuer à un prospecteur
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-500 hover:text-rose-600 text-xs"
                  onClick={() => {
                    if (
                      confirm(
                        `Supprimer définitivement les ${selectedIds.length} commerces sélectionnés ?`
                      )
                    ) {
                      Promise.all(selectedIds.map((id) => deleteProspect(id))).then(() => {
                        setProspects((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
                        setSelectedIds([]);
                      });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}

          {/* TABLEAU HIÉRARCHIQUE INTERACTIF COMPLET */}
          <HierarchicalProspectsTable
            prospects={prospects}
            canEditStatus={true}
            canEditFinale={true} // L'administrateur a le contrôle total de Finale
            onStatusChange={handleStatusChange}
            onFinaleChange={handleAdminChangeFinale}
            enableSelection={true}
            selectedIds={selectedIds}
            onSelectChange={setSelectedIds}
            showProspectorColumn={true}
            defaultHierarchical={true}
          />
        </TabsContent>

        {/* TAB 2: WORKFLOW 5 ÉTAPES IMPORT EXCEL & ATTRIBUTION */}
        <TabsContent value="import" className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-emerald-500" />
                  Assistant d'Importation & d'Attribution Excel (.xlsx)
                </h3>
                <p className="text-sm text-muted">
                  Workflow complet en 5 étapes pour intégrer et confier des listes de prospects à vos prospecteurs.
                </p>
              </div>

              {excelStep > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExcelStep(1);
                    setExcelFile(null);
                    setParseResult(null);
                    setImportReport(null);
                  }}
                >
                  Réinitialiser
                </Button>
              )}
            </div>

            {/* Stepper visuel 5 étapes */}
            <div className="flex items-center justify-between max-w-3xl text-xs font-medium border-b border-border/60 pb-4 overflow-x-auto">
              <span className={`flex items-center gap-1.5 shrink-0 ${excelStep >= 1 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border border-current text-[11px]">1</span>
                Importation
              </span>
              <ChevronRight className="size-4 text-muted shrink-0" />
              <span className={`flex items-center gap-1.5 shrink-0 ${excelStep >= 2 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border border-current text-[11px]">2</span>
                Prévisualisation
              </span>
              <ChevronRight className="size-4 text-muted shrink-0" />
              <span className={`flex items-center gap-1.5 shrink-0 ${excelStep >= 3 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border border-current text-[11px]">3</span>
                Vérification
              </span>
              <ChevronRight className="size-4 text-muted shrink-0" />
              <span className={`flex items-center gap-1.5 shrink-0 ${excelStep >= 4 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border border-current text-[11px]">4</span>
                Attribution
              </span>
              <ChevronRight className="size-4 text-muted shrink-0" />
              <span className={`flex items-center gap-1.5 shrink-0 ${excelStep >= 5 ? "text-emerald-500 font-bold" : "text-muted"}`}>
                <span className="flex size-5 items-center justify-center rounded-full border border-current text-[11px]">5</span>
                Validation
              </span>
            </div>

            {/* ÉTAPE 1 : DRAG & DROP FICHIER EXCEL */}
            {excelStep === 1 && (
              <div className="space-y-4 max-w-2xl">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border/80 hover:border-primary/60 bg-surface/50"
                  }`}
                  onClick={() => document.getElementById("excel-upload-input")?.click()}
                >
                  <input
                    id="excel-upload-input"
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />

                  <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 mb-3">
                    <UploadCloud className="size-8" />
                  </div>

                  <h4 className="font-semibold text-foreground text-sm">
                    Glissez-déposez votre fichier Excel ici
                  </h4>
                  <p className="text-xs text-muted mt-1">
                    ou cliquez pour sélectionner un fichier <strong>.xlsx</strong> sur votre ordinateur
                  </p>

                  <div className="mt-4 rounded-xl border border-border/60 bg-surface p-3 text-[11px] text-muted text-left space-y-1">
                    <div className="font-semibold text-foreground">Colonnes Excel reconnues :</div>
                    <div>1. Nom du prospect | 2. Wilaya | 3. Commune | 4. Téléphone | 5. Activité</div>
                    <div className="text-[10px] text-muted">
                      (Les colonnes Statut et Finale sont initialisées automatiquement si non spécifiées)
                    </div>
                  </div>
                </div>

                {parsing && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted">
                    <RefreshCw className="size-4 animate-spin text-primary" />
                    Lecture et analyse du fichier Excel en cours...
                  </div>
                )}
              </div>
            )}

            {/* ÉTAPE 2 : PRÉVISUALISATION HIÉRARCHIQUE */}
            {excelStep === 2 && parseResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">
                      Fichier analysé : <strong>{parseResult.filename}</strong>
                    </h4>
                    <p className="text-xs text-muted">
                      {parseResult.totalRows} ligne(s) détectée(s) — {parseResult.validRows.length} valide(s),{" "}
                      {parseResult.invalidRows.length} avec erreurs
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setExcelStep(3)} className="gap-1.5">
                    Passer à la vérification
                    <ChevronRight className="size-4" />
                  </Button>
                </div>

                {/* Prévisualisation dans le tableau hiérarchique */}
                <HierarchicalProspectsTable
                  prospects={parseResult.validRows.map((r) => ({
                    id: `temp-${r.index}`,
                    business_name: r.business_name,
                    wilaya: r.wilaya,
                    commune: r.commune,
                    phone: r.phone,
                    category: r.category,
                    status: r.status,
                    finale: r.finale,
                    notes: null,
                    assigned_to: null,
                    created_at: new Date().toISOString(),
                  }))}
                  canEditStatus={false}
                  canEditFinale={false}
                  showProspectorColumn={false}
                  defaultHierarchical={true}
                />
              </div>
            )}

            {/* ÉTAPE 3 : VÉRIFICATION ET DÉTECTION D'ERREURS / DOUBLONS */}
            {excelStep === 3 && parseResult && (
              <div className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="text-2xl font-bold text-emerald-600">
                      {parseResult.validRows.length}
                    </div>
                    <div className="text-xs text-muted">Lignes prêtes</div>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="text-2xl font-bold text-amber-500">
                      {parseResult.duplicateCount}
                    </div>
                    <div className="text-xs text-muted">Doublons téléphoniques</div>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
                    <div className="text-2xl font-bold text-rose-500">
                      {parseResult.invalidRows.length}
                    </div>
                    <div className="text-xs text-muted">Lignes incomplètes</div>
                  </div>
                </div>

                {parseResult.invalidRows.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
                    <div className="text-xs font-semibold text-rose-600 flex items-center gap-1.5">
                      <AlertCircle className="size-4" />
                      Lignes contenant des erreurs (elles seront ignorées lors de l'attribution) :
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                      {parseResult.invalidRows.slice(0, 8).map((r) => (
                        <div key={r.index} className="flex items-center justify-between bg-surface p-2 rounded">
                          <span>
                            Ligne {r.index}: {r.business_name || "(Nom manquant)"}
                          </span>
                          <span className="text-rose-500">{r.errors.join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setExcelStep(2)}>
                    Retour à la prévisualisation
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setExcelStep(4)}
                    disabled={parseResult.validRows.length === 0}
                    className="gap-1.5"
                  >
                    Choisir le prospecteur (Attribution)
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ÉTAPE 4 : ATTRIBUTION À UN PROSPECTEUR */}
            {excelStep === 4 && parseResult && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h4 className="font-semibold text-sm">Attribuer ce fichier Excel</h4>
                  <p className="text-xs text-muted">
                    Sélectionnez le prospecteur qui recevra directement ces{" "}
                    <strong>{parseResult.validRows.length}</strong> commerces dans son dashboard personnel.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Prospecteur commercial responsable :</Label>
                  <Select
                    value={targetImportProspectorId}
                    onValueChange={setTargetImportProspectorId}
                  >
                    <SelectTrigger className="bg-surface">
                      <SelectValue placeholder="Choisir un prospecteur..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ne pas attribuer maintenant (Laisser disponible)</SelectItem>
                      {prospectors.map((pr) => (
                        <SelectItem key={pr.id} value={pr.id}>
                          {pr.full_name} (@{pr.username}) — Wilaya : {pr.wilaya || "Algérie"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border p-4 bg-surface/50 text-xs text-muted space-y-1">
                  <div>• Fichier source : <strong>{parseResult.filename}</strong></div>
                  <div>• Date d'attribution : <strong>{new Date().toLocaleDateString("fr-FR")}</strong></div>
                  <div>• Les anciennes listes et historiques restent strictement préservés.</div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" onClick={() => setExcelStep(3)}>
                    Retour
                  </Button>
                  <Button
                    onClick={handleCommitExcelImport}
                    disabled={committingImport}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {committingImport ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Confirmer et enregistrer dans Supabase
                  </Button>
                </div>
              </div>
            )}

            {/* ÉTAPE 5 : VALIDATION & RAPPORT FINAL */}
            {excelStep === 5 && importReport && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 space-y-4 max-w-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-7 text-emerald-500" />
                  <div>
                    <h4 className="font-bold text-lg text-emerald-950 dark:text-emerald-100">
                      Importation et attribution réussies !
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Les commerces ont été enregistrés et sont dès maintenant synchronisés avec le dashboard du prospecteur.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center pt-2">
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-emerald-600">{importReport.inserted}</div>
                    <div className="text-xs text-muted">Commerces créés</div>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-amber-500">{importReport.duplicates}</div>
                    <div className="text-xs text-muted">Doublons ignorés</div>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-rose-500">{importReport.rejected}</div>
                    <div className="text-xs text-muted">Rejetés</div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setExcelStep(1);
                    setExcelFile(null);
                    setParseResult(null);
                    setImportReport(null);
                    handleTabChange("all");
                  }}
                  className="w-full gap-2 mt-4"
                >
                  Consulter la liste générale des commerces
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODALE CRÉATION PROSPECT */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajouter un commerce prospect</DialogTitle>
            <DialogDescription>
              Fiche manuelle d'un commerce prospect.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProspect} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bname">Nom du prospect *</Label>
                <Input
                  id="bname"
                  placeholder="Ex: Pizzeria Napoli"
                  value={formBusinessName}
                  onChange={(e) => setFormBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone *</Label>
                <Input
                  id="phone"
                  placeholder="0550 12 34 56"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wilaya">Wilaya *</Label>
                <Select value={formWilaya} onValueChange={setFormWilaya}>
                  <SelectTrigger id="wilaya">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {ALGERIA_WILAYAS.map((w) => (
                      <SelectItem key={w.code} value={w.name}>
                        {w.code} - {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="commune">Commune</Label>
                <Input
                  id="commune"
                  placeholder="Ex: Bab Ezzouar"
                  value={formCommune}
                  onChange={(e) => setFormCommune(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat">Activité</Label>
                <Input
                  id="cat"
                  placeholder="Ex: Restaurant, Prêt-à-porter..."
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assigned">Commercial assigné</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger id="assigned">
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {prospectors.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.full_name} (@{pr.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Statut (Commercial)</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProspectStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="callback">À rappeler</SelectItem>
                    <SelectItem value="trial">Essai gratuit</SelectItem>
                    <SelectItem value="rejected">Refusé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Finale (Admin)</Label>
                <Select
                  value={formFinale || "none"}
                  onValueChange={(v) => setFormFinale(v === "none" ? null : (v as "paid" | "unpaid"))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">En attente (Vide)</SelectItem>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="unpaid">Non payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes / Observations</Label>
              <Textarea
                id="notes"
                placeholder="Notes de contact..."
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={savingForm} className="gap-2">
                {savingForm ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
                Créer le prospect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODALE ATTRIBUTION GROUPÉE */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attribuer {selectedIds.length} commerce(s)</DialogTitle>
            <DialogDescription>
              Sélectionnez le prospecteur qui recevra ces commerces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Prospecteur responsable :</Label>
              <Select value={targetProspectorId} onValueChange={setTargetProspectorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un prospecteur..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Désassigner (aucun commercial)</SelectItem>
                  {prospectors.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.full_name} (@{pr.username}) — {pr.wilaya || "Algérie"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleExecuteBatchAssign}
              disabled={!targetProspectorId || assigning}
              className="gap-2"
            >
              {assigning ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirmer l'attribution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
