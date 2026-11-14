import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
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
import { ALGERIA_WILAYAS } from "@/lib/constants/algeria-wilayas";
import { getProspectors } from "@/lib/db/prospectors";
import {
  assignProspects,
  createProspect,
  deleteProspect,
  getProspects,
  importProspectsBatch,
  updateProspect,
} from "@/lib/db/prospects";
import type { Prospect, Prospector, ProspectStatus } from "@/lib/types/prospection";
import { PROSPECT_STATUS_COLORS, PROSPECT_STATUS_LABELS } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/prospects")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "all",
      status: (search.status as string) || undefined,
      wilaya: (search.wilaya as string) || undefined,
      prospectorId: (search.prospectorId as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Gestion des Prospects — M3ak CRM" },
      { name: "description", content: "Gestion, import et attribution des commerces prospects." },
    ],
  }),
  component: ProspectsManagementPage,
});

const ALL_STATUSES: ProspectStatus[] = [
  "new",
  "contacted",
  "interested",
  "callback",
  "trial",
  "converted",
  "rejected",
];

const CATEGORIES = [
  "Restaurant / Café",
  "Boutique / Prêt-à-porter",
  "Superette / Alimentation",
  "Beauté / Coiffure",
  "Santé / Pharmacie",
  "Services & Loisirs",
  "Autre",
];

function ProspectsManagementPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = (searchParams.tab as string) || "all";

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState<string>(searchParams.wilaya || "all");
  const [selectedStatus, setSelectedStatus] = useState<string>(searchParams.status || "all");
  const [selectedProspector, setSelectedProspector] = useState<string>(
    searchParams.prospectorId || "all"
  );

  // Sélections multiples pour attribution ou suppression
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modale Nouveau/Édition Prospect
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [formBusinessName, setFormBusinessName] = useState("");
  const [formContactName, setFormContactName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCategory, setFormCategory] = useState("Restaurant / Café");
  const [formWilaya, setFormWilaya] = useState("Alger");
  const [formCommune, setFormCommune] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formStatus, setFormStatus] = useState<ProspectStatus>("new");
  const [formAssignedTo, setFormAssignedTo] = useState<string>("unassigned");
  const [formNotes, setFormNotes] = useState("");
  const [savingForm, setSavingForm] = useState(false);

  // Modale d'attribution groupée
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [targetProspectorId, setTargetProspectorId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  // Wizard d'importation
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawCsvText, setRawCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    duplicates: number;
    errors: number;
  } | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [pList, prList] = await Promise.all([getProspects(), getProspectors()]);
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
  }, []);

  const handleTabChange = (val: string) => {
    navigate({
      search: (prev) => ({ ...prev, tab: val }),
    });
  };

  // Filtrage
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchSearch =
        p.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.commune?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchWilaya = selectedWilaya === "all" || p.wilaya === selectedWilaya;
      const matchStatus = selectedStatus === "all" || p.status === selectedStatus;
      const matchProspector =
        selectedProspector === "all" ||
        (selectedProspector === "unassigned" ? !p.assigned_to : p.assigned_to === selectedProspector);
      return matchSearch && matchWilaya && matchStatus && matchProspector;
    });
  }, [prospects, searchTerm, selectedWilaya, selectedStatus, selectedProspector]);

  // Sélection globale
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredProspects.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Ouvrir formulaire d'ajout
  const handleOpenCreateModal = () => {
    setEditingProspect(null);
    setFormBusinessName("");
    setFormContactName("");
    setFormPhone("");
    setFormCategory("Restaurant / Café");
    setFormWilaya("Alger");
    setFormCommune("");
    setFormAddress("");
    setFormStatus("new");
    setFormAssignedTo("unassigned");
    setFormNotes("");
    setIsModalOpen(true);
  };

  // Ouvrir formulaire d'édition
  const handleOpenEditModal = (p: Prospect) => {
    setEditingProspect(p);
    setFormBusinessName(p.business_name);
    setFormContactName(p.contact_name || "");
    setFormPhone(p.phone || "");
    setFormCategory(p.category || "Restaurant / Café");
    setFormWilaya(p.wilaya || "Alger");
    setFormCommune(p.commune || "");
    setFormAddress(p.address || "");
    setFormStatus(p.status);
    setFormAssignedTo(p.assigned_to || "unassigned");
    setFormNotes(p.notes || "");
    setIsModalOpen(true);
  };

  // Sauvegarder Prospect (Nouveau ou Édition)
  const handleSaveProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBusinessName.trim() || !formPhone.trim()) {
      alert("Le nom du commerce et le numéro de téléphone sont obligatoires.");
      return;
    }

    setSavingForm(true);
    try {
      const payload: Partial<Prospect> = {
        business_name: formBusinessName.trim(),
        contact_name: formContactName.trim() || undefined,
        phone: formPhone.trim(),
        category: formCategory,
        wilaya: formWilaya,
        commune: formCommune.trim() || undefined,
        address: formAddress.trim() || undefined,
        status: formStatus,
        assigned_to: formAssignedTo === "unassigned" ? null : formAssignedTo,
        notes: formNotes.trim() || undefined,
      };

      if (editingProspect) {
        const updated = await updateProspect(editingProspect.id, payload);
        if (updated) {
          setProspects((prev) => prev.map((p) => (p.id === editingProspect.id ? updated : p)));
        }
      } else {
        const created = await createProspect(payload);
        if (created) {
          setProspects((prev) => [created, ...prev]);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error("Erreur sauvegarde prospect :", err);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSavingForm(false);
    }
  };

  // Suppression
  const handleDeleteProspect = async (id: string, name: string) => {
    if (!confirm(`Supprimer définitivement le commerce "${name}" ?`)) return;
    const ok = await deleteProspect(id);
    if (ok) {
      setProspects((prev) => prev.filter((p) => p.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  // Attribution groupée
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
    } catch (err) {
      console.error("Erreur attribution groupée :", err);
    } finally {
      setAssigning(false);
    }
  };

  // Analyse du texte CSV/TSV
  const handleParseCsv = () => {
    if (!rawCsvText.trim()) return;
    const lines = rawCsvText.trim().split("\n");
    if (lines.length === 0) return;

    const parsed: any[] = [];
    // Parsing souple : séparateur virgule, point-virgule ou tabulation
    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;
      let parts: string[] = [];
      if (cleanLine.includes("\t")) {
        parts = cleanLine.split("\t");
      } else if (cleanLine.includes(";")) {
        parts = cleanLine.split(";");
      } else {
        parts = cleanLine.split(",");
      }

      const row = {
        business_name: parts[0]?.trim() || "",
        phone: parts[1]?.trim() || "",
        wilaya: parts[2]?.trim() || "Alger",
        commune: parts[3]?.trim() || "",
        category: parts[4]?.trim() || "Commerce",
        notes: parts[5]?.trim() || "",
      };

      if (row.business_name && row.phone) {
        parsed.push(row);
      }
    });

    setParsedRows(parsed);
    setImportStep(2);
  };

  // Détection des doublons et Importation réelle
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setImportStep(3);
    try {
      // Détection des doublons avec les prospects existants par téléphone
      const existingPhones = new Set(
        prospects.map((p) => p.phone?.replace(/[\s.-]/g, "") || "")
      );

      const uniqueRows: any[] = [];
      let dupesCount = 0;

      parsedRows.forEach((row) => {
        const cleanPhone = row.phone.replace(/[\s.-]/g, "");
        if (existingPhones.has(cleanPhone)) {
          dupesCount++;
        } else {
          uniqueRows.push({
            business_name: row.business_name,
            phone: row.phone,
            wilaya: row.wilaya,
            commune: row.commune || null,
            category: row.category || "Commerce",
            notes: row.notes || "Importé via assistant",
            status: "new",
          });
        }
      });

      const res = await importProspectsBatch(uniqueRows);
      setImportResult({
        inserted: res.count,
        duplicates: dupesCount,
        errors: res.errors.length,
      });
      setImportStep(4);
      loadData();
    } catch (err) {
      console.error("Erreur import batch :", err);
      alert("Erreur lors de l'importation.");
      setImportStep(2);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gestion des Prospects"
        description="Fichier centralisé des commerces, importation de leads et distribution aux prospecteurs."
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
              <Upload className="size-4" />
              Importer
            </Button>
            <Button size="sm" onClick={handleOpenCreateModal} className="gap-2">
              <Plus className="size-4" />
              Nouveau commerce
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all" className="gap-2">
            <Building2 className="size-4" />
            Tous ({prospects.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <FileSpreadsheet className="size-4" />
            Importer des prospects
          </TabsTrigger>
          <TabsTrigger value="assign" className="gap-2">
            <Layers className="size-4" />
            Attribution des listes
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TOUS LES COMMERCES */}
        <TabsContent value="all" className="space-y-4">
          {/* Barre de filtres et recherche */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Rechercher par nom de commerce, téléphone, contact..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedWilaya} onValueChange={setSelectedWilaya}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Wilaya" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Toutes wilayas</SelectItem>
                  {ALGERIA_WILAYAS.map((w) => (
                    <SelectItem key={w.code} value={w.name}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {ALL_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {PROSPECT_STATUS_LABELS[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedProspector} onValueChange={setSelectedProspector}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Prospecteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les prospecteurs</SelectItem>
                  <SelectItem value="unassigned">Non assignés</SelectItem>
                  {prospectors.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Barre d'action groupée si sélection > 0 */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-primary">
                <CheckCircle2 className="size-4" />
                {selectedIds.length} commerce(s) sélectionné(s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="gap-1.5 bg-surface"
                >
                  <UserCheck className="size-4" />
                  Attribuer à un prospecteur
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-500 hover:text-rose-600"
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
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </div>
            </div>
          )}

          {/* Tableau */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-surface/90">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        filteredProspects.length > 0 &&
                        selectedIds.length === filteredProspects.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Commerce</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Wilaya / Secteur</TableHead>
                  <TableHead>Prospecteur assigné</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted">
                        <RefreshCw className="size-4 animate-spin" />
                        Chargement des prospects...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProspects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-muted">
                      Aucun commerce trouvé avec ces critères.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspects.map((p) => {
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <TableRow
                        key={p.id}
                        className={`hover:bg-surface/90 ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelectOne(p.id)}
                          />
                        </TableCell>

                        <TableCell>
                          <div>
                            <div className="font-semibold text-foreground">
                              {p.business_name}
                            </div>
                            {p.contact_name && (
                              <div className="text-xs text-muted">Gérant : {p.contact_name}</div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="text-xs text-muted-foreground">{p.category || "—"}</span>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 font-mono text-sm">
                            <Phone className="size-3.5 text-muted" />
                            {p.phone || "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <MapPin className="size-3.5 text-muted shrink-0" />
                            <span>{p.wilaya || "—"}</span>
                            {p.commune && (
                              <span className="text-xs text-muted">({p.commune})</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {p.prospector ? (
                            <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                              <UserCheck className="size-3" />
                              {p.prospector.full_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted italic">Non assigné</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              PROSPECT_STATUS_COLORS[p.status]
                            }`}
                          >
                            {PROSPECT_STATUS_LABELS[p.status]}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(p)}
                              title="Modifier la fiche"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-500 hover:text-rose-600"
                              onClick={() => handleDeleteProspect(p.id, p.business_name)}
                              title="Supprimer"
                            >
                              <Trash2 className="size-4" />
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
        </TabsContent>

        {/* TAB 2: IMPORTER DES PROSPECTS */}
        <TabsContent value="import" className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-6">
            <div>
              <h3 className="font-semibold text-lg">Assistant d'Importation de Fichier Leads</h3>
              <p className="text-sm text-muted">
                Importez facilement des listes de commerçants au format CSV, Excel ou texte brut copié-collé.
              </p>
            </div>

            {/* Étapes du wizard */}
            <div className="flex items-center justify-between max-w-xl text-xs font-medium">
              <span className={`flex items-center gap-1.5 ${importStep >= 1 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-6 items-center justify-center rounded-full border border-current">1</span>
                Saisie / Fichier
              </span>
              <ChevronRight className="size-4 text-muted" />
              <span className={`flex items-center gap-1.5 ${importStep >= 2 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-6 items-center justify-center rounded-full border border-current">2</span>
                Prévisualisation
              </span>
              <ChevronRight className="size-4 text-muted" />
              <span className={`flex items-center gap-1.5 ${importStep >= 3 ? "text-primary font-bold" : "text-muted"}`}>
                <span className="flex size-6 items-center justify-center rounded-full border border-current">3</span>
                Dédoublonnage
              </span>
              <ChevronRight className="size-4 text-muted" />
              <span className={`flex items-center gap-1.5 ${importStep >= 4 ? "text-emerald-500 font-bold" : "text-muted"}`}>
                <span className="flex size-6 items-center justify-center rounded-full border border-current">4</span>
                Résultat
              </span>
            </div>

            {/* Étape 1: Upload / Collage */}
            {importStep === 1 && (
              <div className="space-y-4 max-w-2xl">
                <div className="rounded-xl border border-dashed border-border p-4 bg-surface/50 text-xs text-muted space-y-1">
                  <div className="font-semibold text-foreground">Format attendu des colonnes :</div>
                  <code>Nom du commerce ; Téléphone ; Wilaya ; Commune ; Catégorie ; Notes</code>
                  <p className="pt-1">
                    Séparateurs acceptés : tabulation (copié depuis Excel), point-virgule (;) ou virgule (,).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Collez vos données brutes ou contenu CSV :</Label>
                  <Textarea
                    placeholder="Restaurant Le Sultan ; 0550112233 ; Alger ; Bab Ezzouar ; Restaurant&#10;Boutique Moda ; 0661445566 ; Oran ; Es Senia ; Prêt-à-porter"
                    rows={8}
                    className="font-mono text-xs"
                    value={rawCsvText}
                    onChange={(e) => setRawCsvText(e.target.value)}
                  />
                </div>

                <Button onClick={handleParseCsv} disabled={!rawCsvText.trim()} className="gap-2">
                  <FileText className="size-4" />
                  Analyser et prévisualiser
                </Button>
              </div>
            )}

            {/* Étape 2: Prévisualisation */}
            {importStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">
                    {parsedRows.length} ligne(s) détectée(s) prêtes à être importées
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImportStep(1)}>
                    Modifier les données
                  </Button>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commerce</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Wilaya</TableHead>
                        <TableHead>Commune</TableHead>
                        <TableHead>Catégorie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-semibold">{r.business_name}</TableCell>
                          <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                          <TableCell>{r.wilaya}</TableCell>
                          <TableCell>{r.commune || "—"}</TableCell>
                          <TableCell className="text-xs text-muted">{r.category}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {parsedRows.length > 10 && (
                  <p className="text-xs text-muted text-center">
                    ... et {parsedRows.length - 10} autre(s) ligne(s)
                  </p>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <Button onClick={handleExecuteImport} disabled={importing} className="gap-2">
                    <Upload className="size-4" />
                    Vérifier les doublons et importer dans Supabase
                  </Button>
                </div>
              </div>
            )}

            {/* Étape 3: Chargement */}
            {importStep === 3 && (
              <div className="flex flex-col items-center justify-center p-12 space-y-3">
                <RefreshCw className="size-8 animate-spin text-primary" />
                <div className="font-semibold">Importation et dédoublonnage en cours...</div>
                <div className="text-xs text-muted">Vérification des numéros de téléphone existants.</div>
              </div>
            )}

            {/* Étape 4: Résumé */}
            {importStep === 4 && importResult && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-4 max-w-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-6 text-emerald-500" />
                  <h4 className="font-bold text-lg text-emerald-950 dark:text-emerald-100">
                    Rapport d'importation terminé
                  </h4>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-emerald-600">{importResult.inserted}</div>
                    <div className="text-xs text-muted">Nouveaux leads</div>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-amber-500">{importResult.duplicates}</div>
                    <div className="text-xs text-muted">Doublons ignorés</div>
                  </div>
                  <div className="rounded-xl bg-surface p-3 border border-border">
                    <div className="text-2xl font-bold text-rose-500">{importResult.errors}</div>
                    <div className="text-xs text-muted">Erreurs</div>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setImportStep(1);
                    setRawCsvText("");
                    setParsedRows([]);
                    setImportResult(null);
                    handleTabChange("all");
                  }}
                  className="w-full gap-2"
                >
                  Voir les commerces dans la liste
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: ATTRIBUTION DES LISTES */}
        <TabsContent value="assign" className="space-y-6">
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-6">
            <div>
              <h3 className="font-semibold text-lg">Distribution & Attribution en Masse</h3>
              <p className="text-sm text-muted">
                Sélectionnez des lots de prospects non assignés et confiez-les directement à un prospecteur de la wilaya concernée.
              </p>
            </div>

            {/* Sélecteur de prospecteur cible */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 p-4 rounded-xl border border-border bg-surface/50">
              <div className="space-y-1.5 flex-1">
                <Label>Affecter à ce prospecteur commercial :</Label>
                <Select value={targetProspectorId} onValueChange={setTargetProspectorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un prospecteur..." />
                  </SelectTrigger>
                  <SelectContent>
                    {prospectors.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.full_name} ({pr.wilaya || "Algérie"} - {pr.assigned_count || 0} prospects)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleExecuteBatchAssign}
                disabled={!targetProspectorId || selectedIds.length === 0 || assigning}
                className="gap-2 shrink-0"
              >
                {assigning ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <UserCheck className="size-4" />
                )}
                Attribuer {selectedIds.length} commerce(s)
              </Button>
            </div>

            {/* Liste rapide des non-assignés */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Commerces non encore attribués (
                  {prospects.filter((p) => !p.assigned_to).length})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const unassignedIds = prospects.filter((p) => !p.assigned_to).map((p) => p.id);
                    setSelectedIds(unassignedIds);
                  }}
                >
                  Sélectionner tous les non-attribués
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            prospects.filter((p) => !p.assigned_to).length > 0 &&
                            selectedIds.length === prospects.filter((p) => !p.assigned_to).length
                          }
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(prospects.filter((p) => !p.assigned_to).map((p) => p.id));
                            } else {
                              setSelectedIds([]);
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Commerce</TableHead>
                      <TableHead>Wilaya</TableHead>
                      <TableHead>Commune</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prospects
                      .filter((p) => !p.assigned_to)
                      .map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.includes(p.id)}
                              onCheckedChange={() => handleToggleSelectOne(p.id)}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{p.business_name}</TableCell>
                          <TableCell>{p.wilaya}</TableCell>
                          <TableCell>{p.commune || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{p.phone}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                PROSPECT_STATUS_COLORS[p.status]
                              }`}
                            >
                              {PROSPECT_STATUS_LABELS[p.status]}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODALE CRÉATION / MODIFICATION PROSPECT */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingProspect ? "Modifier la fiche prospect" : "Ajouter un nouveau commerce prospect"}
            </DialogTitle>
            <DialogDescription>
              Renseignez les coordonnées et informations de prospection du commerce.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProspect} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bname">Nom de l'établissement *</Label>
                <Input
                  id="bname"
                  placeholder="Ex: Pizzeria Napoli"
                  value={formBusinessName}
                  onChange={(e) => setFormBusinessName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cname">Nom du contact / gérant</Label>
                <Input
                  id="cname"
                  placeholder="Ex: M. Amar"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-1.5">
                <Label htmlFor="cat">Catégorie d'activité</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="cat">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="wilaya">Wilaya *</Label>
                <Select value={formWilaya} onValueChange={setFormWilaya}>
                  <SelectTrigger id="wilaya">
                    <SelectValue placeholder="Choisir" />
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
                <Label htmlFor="commune">Commune / Secteur</Label>
                <Input
                  id="commune"
                  placeholder="Ex: Rouiba"
                  value={formCommune}
                  onChange={(e) => setFormCommune(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Statut de prospection</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as ProspectStatus)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {PROSPECT_STATUS_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assigned">Prospecteur assigné</Label>
                <Select value={formAssignedTo} onValueChange={setFormAssignedTo}>
                  <SelectTrigger id="assigned">
                    <SelectValue placeholder="Non assigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {prospectors.map((pr) => (
                      <SelectItem key={pr.id} value={pr.id}>
                        {pr.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes d'échange / Remarques commerciales</Label>
              <Textarea
                id="notes"
                placeholder="Discussions téléphoniques, objections, heure de passage préférée..."
                rows={3}
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
                {editingProspect ? "Mettre à jour" : "Créer le prospect"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODALE D'ATTRIBUTION GROUPÉE */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attribuer {selectedIds.length} commerce(s)</DialogTitle>
            <DialogDescription>
              Sélectionnez le prospecteur qui sera responsable de ces commerces.
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
                  <SelectItem value="unassigned">Désassigner (aucun prospecteur)</SelectItem>
                  {prospectors.map((pr) => (
                    <SelectItem key={pr.id} value={pr.id}>
                      {pr.full_name} ({pr.wilaya || "Algérie"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignModalOpen(false)}
            >
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

