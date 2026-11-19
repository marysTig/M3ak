import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Lock,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import React, { Fragment, useMemo, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { ALGERIA_WILAYAS } from "@/lib/constants/algeria-wilayas";
import { updateProspectNotes } from "@/lib/db/prospects";
import type { Prospect, ProspectFinale, ProspectStatus } from "@/lib/types/prospection";
import {
  PROSPECTOR_EDITABLE_STATUSES,
  PROSPECT_FINALE_COLORS,
  PROSPECT_FINALE_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
} from "@/lib/types/prospection";

/**
 * Normalise automatiquement les numéros algériens pour l'API WhatsApp (wa.me)
 * Format requis : 213XXXXXXXXX (sans +, sans espaces, sans 0 initial)
 */
export function formatWhatsAppUrl(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  let digits = rawPhone.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("2130")) {
    digits = "213" + digits.slice(4);
  } else if (digits.startsWith("0")) {
    digits = "213" + digits.slice(1);
  } else if (digits.startsWith("213")) {
    digits = digits;
  } else if (digits.length === 9) {
    digits = "213" + digits;
  }

  return `https://wa.me/${digits}`;
}

function WhatsAppIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      fill="currentColor"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface HierarchicalProspectsTableProps {
  prospects: Prospect[];
  canEditStatus?: boolean; // Prospecteur ou Admin
  canEditFinale?: boolean; // STRICTEMENT Admin
  canEditNotes?: boolean; // Édition des notes (défaut: true)
  onStatusChange?: (prospectId: string, status: ProspectStatus) => Promise<void> | void;
  onFinaleChange?: (prospectId: string, finale: ProspectFinale) => Promise<void> | void;
  onNotesChange?: (prospectId: string, notes: string | null) => Promise<void> | void;
  selectedIds?: string[];
  onSelectChange?: (selectedIds: string[]) => void;
  enableSelection?: boolean;
  showProspectorColumn?: boolean;
  defaultHierarchical?: boolean;
}

export function HierarchicalProspectsTable({
  prospects,
  canEditStatus = false,
  canEditFinale = false,
  canEditNotes = true,
  onStatusChange,
  onFinaleChange,
  onNotesChange,
  selectedIds = [],
  onSelectChange,
  enableSelection = false,
  showProspectorColumn = true,
  defaultHierarchical = false,
}: HierarchicalProspectsTableProps) {
  // Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("all");
  const [selectedCommune, setSelectedCommune] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedFinale, setSelectedFinale] = useState("all");
  const [selectedProspector, setSelectedProspector] = useState("all");
  const [isHierarchicalView, setIsHierarchicalView] = useState(defaultHierarchical);

  // Groupes dépliés
  const [expandedWilayas, setExpandedWilayas] = useState<Record<string, boolean>>({});
  const [expandedCommunes, setExpandedCommunes] = useState<Record<string, boolean>>({});

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Notes modale & état réactif local
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [localNotes, setLocalNotes] = useState<Record<string, string | null>>({});

  const handleOpenNote = (p: Prospect) => {
    setEditingProspect(p);
    const currentNote = localNotes[p.id] !== undefined ? localNotes[p.id] : p.notes;
    setNoteText(currentNote || "");
  };

  const handleSaveNote = async () => {
    if (!editingProspect) return;
    setSavingNote(true);
    const trimmed = noteText.trim() || null;
    try {
      await updateProspectNotes(editingProspect.id, trimmed);
      setLocalNotes((prev) => ({ ...prev, [editingProspect.id]: trimmed }));
      if (onNotesChange) {
        await onNotesChange(editingProspect.id, trimmed);
      }
      setEditingProspect(null);
    } catch (err: any) {
      console.error("Erreur sauvegarde note :", err);
      alert(`Erreur lors de l'enregistrement de la note : ${err?.message || "Veuillez réessayer."}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!editingProspect) return;
    if (!window.confirm("Voulez-vous vraiment effacer cette note ?")) return;
    setSavingNote(true);
    try {
      await updateProspectNotes(editingProspect.id, null);
      setLocalNotes((prev) => ({ ...prev, [editingProspect.id]: null }));
      if (onNotesChange) {
        await onNotesChange(editingProspect.id, null);
      }
      setEditingProspect(null);
    } catch (err: any) {
      console.error("Erreur suppression note :", err);
      alert(`Erreur lors de la suppression de la note : ${err?.message || "Veuillez réessayer."}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Enrichir les prospects avec les notes locales
  const enrichedProspects = useMemo(() => {
    return prospects.map((p) => {
      if (localNotes[p.id] !== undefined) {
        return { ...p, notes: localNotes[p.id] };
      }
      return p;
    });
  }, [prospects, localNotes]);

  // Extraction unique des communes et activités pour les filtres
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    enrichedProspects.forEach((p) => {
      if (p.commune && (selectedWilaya === "all" || p.wilaya === selectedWilaya)) {
        set.add(p.commune);
      }
    });
    return Array.from(set).sort();
  }, [enrichedProspects, selectedWilaya]);

  const availableActivities = useMemo(() => {
    const set = new Set<string>();
    enrichedProspects.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [enrichedProspects]);

  const availableProspectors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    enrichedProspects.forEach((p) => {
      if (p.assigned_to && p.prospector) {
        map.set(p.assigned_to, {
          id: p.assigned_to,
          name: p.prospector.full_name || p.prospector.username || "Commercial",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [enrichedProspects]);

  // Filtrage
  const filteredProspects = useMemo(() => {
    return enrichedProspects.filter((p) => {
      const matchSearch =
        !searchTerm.trim() ||
        p.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.commune?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.wilaya?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.notes?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchWilaya = selectedWilaya === "all" || p.wilaya === selectedWilaya;
      const matchCommune = selectedCommune === "all" || p.commune === selectedCommune;
      const matchActivity = selectedActivity === "all" || p.category === selectedActivity;
      const matchStatus = selectedStatus === "all" || p.status === selectedStatus;

      let matchFinale = true;
      if (selectedFinale === "paid") matchFinale = p.finale === "paid";
      else if (selectedFinale === "unpaid") matchFinale = p.finale === "unpaid";
      else if (selectedFinale === "none") matchFinale = !p.finale;

      const matchProspector =
        selectedProspector === "all" ||
        (selectedProspector === "unassigned" ? !p.assigned_to : p.assigned_to === selectedProspector);

      return matchSearch && matchWilaya && matchCommune && matchActivity && matchStatus && matchFinale && matchProspector;
    });
  }, [
    enrichedProspects,
    searchTerm,
    selectedWilaya,
    selectedCommune,
    selectedActivity,
    selectedStatus,
    selectedFinale,
    selectedProspector,
  ]);

  // Arbre hiérarchique : Wilaya -> Commune -> Prospects
  const hierarchicalTree = useMemo(() => {
    const tree: Record<string, Record<string, Prospect[]>> = {};

    filteredProspects.forEach((p) => {
      const w = p.wilaya || "Non spécifiée";
      const c = p.commune || "Non spécifiée";

      if (!tree[w]) tree[w] = {};
      if (!tree[w][c]) tree[w][c] = [];
      tree[w][c].push(p);
    });

    return tree;
  }, [filteredProspects]);

  // Toggle plié/déplié
  const toggleWilaya = (w: string) => {
    setExpandedWilayas((prev) => ({ ...prev, [w]: !prev[w] }));
  };

  const toggleCommune = (key: string) => {
    setExpandedCommunes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const allW: Record<string, boolean> = {};
    const allC: Record<string, boolean> = {};
    Object.keys(hierarchicalTree).forEach((w) => {
      allW[w] = true;
      Object.keys(hierarchicalTree[w]).forEach((c) => {
        allC[`${w}__${c}`] = true;
      });
    });
    setExpandedWilayas(allW);
    setExpandedCommunes(allC);
  };

  const collapseAll = () => {
    setExpandedWilayas({});
    setExpandedCommunes({});
  };

  // Sélection
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectChange) return;
    if (checked) {
      onSelectChange(filteredProspects.map((p) => p.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    if (!onSelectChange) return;
    if (selectedIds.includes(id)) {
      onSelectChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectChange([...selectedIds, id]);
    }
  };

  // Pagination sur vue plate
  const totalPages = Math.ceil(filteredProspects.length / pageSize) || 1;
  const paginatedProspects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProspects.slice(start, start + pageSize);
  }, [filteredProspects, currentPage, pageSize]);

  return (
    <div className="space-y-4">
      {/* Barre supérieure de recherche & filtres */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Rechercher par nom de prospect ou téléphone..."
              className="pl-9 bg-surface"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={isHierarchicalView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsHierarchicalView(true)}
              className="text-xs gap-1.5"
            >
              <Building2 className="size-3.5" />
              Vue Hiérarchique
            </Button>
            <Button
              variant={!isHierarchicalView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsHierarchicalView(false)}
              className="text-xs gap-1.5"
            >
              Vue Tableau Simple
            </Button>
          </div>
        </div>

        {/* Ligne des filtres détaillés */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
          {/* Wilaya (69 wilayas) */}
          <Select
            value={selectedWilaya}
            onValueChange={(v) => {
              setSelectedWilaya(v);
              setSelectedCommune("all");
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-surface">
              <SelectValue placeholder="Toutes les wilayas (69)" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">Toutes les wilayas (69)</SelectItem>
              {ALGERIA_WILAYAS.map((w) => (
                <SelectItem key={w.code} value={w.name}>
                  {w.code} - {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Commune */}
          <Select
            value={selectedCommune}
            onValueChange={(v) => {
              setSelectedCommune(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-surface">
              <SelectValue placeholder="Toutes communes" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Toutes communes</SelectItem>
              {availableCommunes.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Activité */}
          <Select
            value={selectedActivity}
            onValueChange={(v) => {
              setSelectedActivity(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-surface">
              <SelectValue placeholder="Toutes activités" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="all">Toutes activités</SelectItem>
              {availableActivities.map((act) => (
                <SelectItem key={act} value={act}>
                  {act}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Statut (Prospecteur) */}
          <Select
            value={selectedStatus}
            onValueChange={(v) => {
              setSelectedStatus(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-surface">
              <SelectValue placeholder="Tous statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous statuts</SelectItem>
              <SelectItem value="callback">À rappeler</SelectItem>
              <SelectItem value="trial">Essai gratuit</SelectItem>
              <SelectItem value="rejected">Refusé</SelectItem>
            </SelectContent>
          </Select>

          {/* Finale (Admin) */}
          <Select
            value={selectedFinale}
            onValueChange={(v) => {
              setSelectedFinale(v);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 text-xs bg-surface font-medium text-slate-800 dark:text-slate-200">
              <SelectValue placeholder="Résultat Finale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes (Finale)</SelectItem>
              <SelectItem value="paid" className="text-emerald-700 font-semibold">Payé</SelectItem>
              <SelectItem value="unpaid" className="text-rose-700 font-semibold">Non payé</SelectItem>
              <SelectItem value="none" className="text-slate-700 font-medium">En attente (Vide)</SelectItem>
            </SelectContent>
          </Select>

          {/* Prospecteur */}
          {showProspectorColumn && availableProspectors.length > 0 && (
            <Select
              value={selectedProspector}
              onValueChange={(v) => {
                setSelectedProspector(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs bg-surface font-medium text-slate-800 dark:text-slate-200">
                <SelectValue placeholder="Prospecteur..." />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                <SelectItem value="all">Tous prospecteurs</SelectItem>
                <SelectItem value="unassigned" className="text-amber-600 font-medium">Non assignés</SelectItem>
                {availableProspectors.map((pr) => (
                  <SelectItem key={pr.id} value={pr.id}>
                    {pr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Barre d'état & actions de groupe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 px-1 font-medium">
        <div className="flex items-center gap-2">
          <span>
            Total : <strong className="font-bold text-foreground">{filteredProspects.length}</strong> prospect(s) affiché(s) sur{" "}
            <strong className="font-bold text-foreground">{prospects.length}</strong>
          </span>
          {enableSelection && selectedIds.length > 0 && (
            <span className="font-bold text-primary">
              • {selectedIds.length} sélectionné(s)
            </span>
          )}
        </div>

        {isHierarchicalView && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-primary font-semibold hover:underline"
            >
              Tout déplier
            </button>
            <span className="text-slate-400">•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-slate-700 dark:text-slate-300 font-semibold hover:text-foreground hover:underline transition-colors"
            >
              Tout replier
            </button>
          </div>
        )}
      </div>

      {/* Rendu Responsive : Cartes sur Mobile (block md:hidden) / Tableau complet sur Desktop (hidden md:block) */}
      <div className="w-full overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">

        {/* ─── VUE MOBILE : CARTES PAR PROSPECT (AUCUN SCROLL HORIZONTAL) ─── */}
        <div className="block md:hidden p-2.5 sm:p-3 space-y-2.5">
          {filteredProspects.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs">
              Aucun prospect ne correspond aux critères de recherche.
            </div>
          ) : isHierarchicalView ? (
            // VUE HIÉRARCHIQUE MOBILE (Wilayas & Communes pliables)
            Object.keys(hierarchicalTree).map((wilayaName) => {
              const communesMap = hierarchicalTree[wilayaName];
              const totalInWilaya = Object.values(communesMap).reduce(
                (sum, list) => sum + list.length,
                0
              );
              const isWilayaExpanded = expandedWilayas[wilayaName] ?? true;

              return (
                <div key={`m-w-${wilayaName}`} className="rounded-2xl border border-border/80 bg-surface/90 overflow-hidden shadow-xs">
                  {/* Header Wilaya Mobile */}
                  <button
                    type="button"
                    onClick={() => toggleWilaya(wilayaName)}
                    className="w-full p-2.5 sm:p-3 flex items-center justify-between text-left font-bold text-foreground text-xs sm:text-sm bg-surface hover:bg-surface/80 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isWilayaExpanded ? (
                        <ChevronDown className="size-4 text-primary shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 text-muted shrink-0" />
                      )}
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">Wilaya : {wilayaName}</span>
                    </div>
                    <Badge variant="secondary" className="text-[11px] font-bold shrink-0">
                      {totalInWilaya}
                    </Badge>
                  </button>

                  {/* Communes et prospects */}
                  {isWilayaExpanded && (
                    <div className="p-2 space-y-2 border-t border-border/60 bg-surface-muted/30">
                      {Object.keys(communesMap).map((communeName) => {
                        const communeProspects = communesMap[communeName] ?? [];
                        const communeKey = `${wilayaName}__${communeName}`;
                        const isCommuneExpanded = expandedCommunes[communeKey] ?? true;

                        return (
                          <div key={`m-c-${communeKey}`} className="rounded-xl border border-border/60 bg-surface overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleCommune(communeKey)}
                              className="w-full p-2 flex items-center justify-between text-left font-semibold text-xs text-foreground bg-surface hover:bg-surface/80"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                {isCommuneExpanded ? (
                                  <ChevronDown className="size-3 text-slate-600 shrink-0" />
                                ) : (
                                  <ChevronRight className="size-3 text-slate-600 shrink-0" />
                                )}
                                <span className="truncate">Commune : {communeName}</span>
                              </div>
                              <span className="text-[10px] font-bold text-muted shrink-0">
                                {communeProspects.length}
                              </span>
                            </button>

                            {isCommuneExpanded && (
                              <div className="p-2 space-y-2 border-t border-border/40">
                                {communeProspects.map((p) => (
                                  <ProspectMobileCard
                                    key={p.id}
                                    prospect={p}
                                    enableSelection={enableSelection}
                                    isSelected={selectedIds.includes(p.id)}
                                    onToggleSelect={() => handleToggleSelectOne(p.id)}
                                    canEditStatus={canEditStatus}
                                    canEditFinale={canEditFinale}
                                    canEditNotes={canEditNotes}
                                    onOpenNote={handleOpenNote}
                                    onStatusChange={onStatusChange}
                                    onFinaleChange={onFinaleChange}
                                    showProspectorColumn={showProspectorColumn}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            // VUE SIMPLE PLATE MOBILE (Cartes pleine largeur sans scroll horizontal)
            paginatedProspects.map((p) => (
              <ProspectMobileCard
                key={p.id}
                prospect={p}
                enableSelection={enableSelection}
                isSelected={selectedIds.includes(p.id)}
                onToggleSelect={() => handleToggleSelectOne(p.id)}
                canEditStatus={canEditStatus}
                canEditFinale={canEditFinale}
                canEditNotes={canEditNotes}
                onOpenNote={handleOpenNote}
                onStatusChange={onStatusChange}
                onFinaleChange={onFinaleChange}
                showProspectorColumn={showProspectorColumn}
              />
            ))
          )}
        </div>

        {/* ─── VUE DESKTOP : TABLEAU COMPLET (hidden md:block) ─── */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full min-w-[850px] table-fixed caption-bottom text-sm border-collapse">
            <thead className="bg-surface/90 [&_tr]:border-b">
              <TableRow className="border-b border-border/80">
                {enableSelection && (
                  <TableHead className="w-12 text-center shrink-0">
                    <Checkbox
                      checked={
                        filteredProspects.length > 0 &&
                        selectedIds.length === filteredProspects.length
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead className="min-w-[190px] w-[21%]">1. Nom du prospect</TableHead>
                <TableHead className="min-w-[105px] w-[11%] whitespace-nowrap">2. Wilaya</TableHead>
                <TableHead className="min-w-[110px] w-[11%] whitespace-nowrap">3. Commune</TableHead>
                <TableHead className="min-w-[130px] w-[13%] whitespace-nowrap">4. Téléphone</TableHead>
                <TableHead className="min-w-[120px] w-[12%] whitespace-nowrap">5. Activité</TableHead>
                {showProspectorColumn && (
                  <TableHead className="min-w-[115px] w-[11%] whitespace-nowrap">Commercial</TableHead>
                )}
                <TableHead className="min-w-[110px] w-[10%] whitespace-nowrap text-center">6. Statut</TableHead>
                <TableHead className="min-w-[110px] w-[10%] whitespace-nowrap text-center">7. Finale</TableHead>
                <TableHead className="min-w-[125px] w-[12%] whitespace-nowrap">8. Note</TableHead>
              </TableRow>
            </thead>
            <tbody>
              {filteredProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={enableSelection ? (showProspectorColumn ? 10 : 9) : (showProspectorColumn ? 9 : 8)} className="h-36 text-center text-muted">
                    Aucun prospect ne correspond aux critères de recherche.
                  </TableCell>
                </TableRow>
              ) : isHierarchicalView ? (
                // ─── VUE HIÉRARCHIQUE (Wilaya -> Commune -> Prospects) ───
                Object.keys(hierarchicalTree).map((wilayaName) => {
                  const communesMap = hierarchicalTree[wilayaName];
                  const totalInWilaya = Object.values(communesMap).reduce(
                    (sum, list) => sum + list.length,
                    0
                  );
                  const isWilayaExpanded = expandedWilayas[wilayaName] ?? true;

                  return (
                    <Fragment key={`w-${wilayaName}`}>
                      {/* LIGNE HEADER WILAYA */}
                      <tr className="bg-surface/90 hover:bg-surface font-semibold text-foreground text-sm cursor-pointer select-none border-b border-border/60">
                        <td
                          colSpan={enableSelection ? (showProspectorColumn ? 10 : 9) : (showProspectorColumn ? 9 : 8)}
                          className="p-3"
                          onClick={() => toggleWilaya(wilayaName)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isWilayaExpanded ? (
                                <ChevronDown className="size-4 text-primary shrink-0" />
                              ) : (
                                <ChevronRight className="size-4 text-muted shrink-0" />
                              )}
                              <MapPin className="size-4 text-primary shrink-0" />
                              <span className="whitespace-nowrap">Wilaya : {wilayaName}</span>
                            </div>
                            <Badge variant="secondary" className="font-mono text-xs whitespace-nowrap">
                              {totalInWilaya} prospect(s)
                            </Badge>
                          </div>
                        </td>
                      </tr>

                      {/* COMMUNES SOUS CETTE WILAYA */}
                      {isWilayaExpanded &&
                        Object.keys(communesMap).map((communeName) => {
                          const communeProspects = communesMap[communeName];
                          const communeKey = `${wilayaName}__${communeName}`;
                          const isCommuneExpanded = expandedCommunes[communeKey] ?? true;

                          return (
                            <Fragment key={`c-${communeKey}`}>
                              {/* LIGNE HEADER COMMUNE */}
                              <tr className="bg-surface/40 hover:bg-surface/60 text-xs font-medium cursor-pointer select-none border-b border-border/40">
                                <td
                                  colSpan={enableSelection ? (showProspectorColumn ? 10 : 9) : (showProspectorColumn ? 9 : 8)}
                                  className="py-2.5 px-6"
                                  onClick={() => toggleCommune(communeKey)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {isCommuneExpanded ? (
                                        <ChevronDown className="size-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                                      ) : (
                                        <ChevronRight className="size-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
                                      )}
                                      <span className="text-foreground whitespace-nowrap font-bold text-slate-800 dark:text-slate-100">
                                        Commune : {communeName}
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap font-semibold">
                                      {communeProspects.length} prospect(s)
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {/* PROSPECTS DE LA COMMUNE */}
                              {isCommuneExpanded &&
                                communeProspects.map((p) => (
                                  <ProspectRow
                                    key={p.id}
                                    prospect={p}
                                    enableSelection={enableSelection}
                                    isSelected={selectedIds.includes(p.id)}
                                    onToggleSelect={() => handleToggleSelectOne(p.id)}
                                    canEditStatus={canEditStatus}
                                    canEditFinale={canEditFinale}
                                    canEditNotes={canEditNotes}
                                    onOpenNote={handleOpenNote}
                                    onStatusChange={onStatusChange}
                                    onFinaleChange={onFinaleChange}
                                    showProspectorColumn={showProspectorColumn}
                                    indent
                                  />
                                ))}
                            </Fragment>
                          );
                        })}
                    </Fragment>
                  );
                })
              ) : (
                // ─── VUE PLATE SIMPLE AVEC PAGINATION ───
                paginatedProspects.map((p) => (
                  <ProspectRow
                    key={p.id}
                    prospect={p}
                    enableSelection={enableSelection}
                    isSelected={selectedIds.includes(p.id)}
                    onToggleSelect={() => handleToggleSelectOne(p.id)}
                    canEditStatus={canEditStatus}
                    canEditFinale={canEditFinale}
                    canEditNotes={canEditNotes}
                    onOpenNote={handleOpenNote}
                    onStatusChange={onStatusChange}
                    onFinaleChange={onFinaleChange}
                    showProspectorColumn={showProspectorColumn}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination sur vue plate */}
        {!isHierarchicalView && filteredProspects.length > pageSize && (
          <div className="flex items-center justify-between p-4 border-t border-border text-xs text-muted">
            <div>
              Page {currentPage} sur {totalPages} ({filteredProspects.length} résultats)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODALE D'ÉDITION DE NOTE PERSONNELLE ─── */}
      <Dialog open={!!editingProspect} onOpenChange={(open) => !open && setEditingProspect(null)}>
        <DialogContent className="max-w-md w-[calc(100%-1.5rem)] rounded-2xl p-4 sm:p-5">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
              <FileText className="size-3.5" />
              <span>Note Commerciale</span>
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              {editingProspect?.business_name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{editingProspect?.wilaya} {editingProspect?.commune ? `• ${editingProspect.commune}` : ""}</span>
              {editingProspect?.phone && (
                <>
                  <span>•</span>
                  <span className="font-mono">{editingProspect.phone}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {editingProspect?.prospector && (
              <div className="flex items-center gap-2 text-xs bg-surface-muted/60 p-2.5 rounded-xl border border-border/60">
                <UserCheck className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Commercial assigné :</span>
                <strong className="text-foreground">{editingProspect.prospector.full_name}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="prospect-note-field" className="text-xs font-semibold text-foreground">
                  Remarques, détails d'appel ou de visite
                </Label>
                {noteText.length > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {noteText.length} car.
                  </span>
                )}
              </div>
              <Textarea
                id="prospect-note-field"
                placeholder="Ex: Responsable intéressé par la fidélité, rappeler mardi à 14h, gérant s'appelle Amine..."
                rows={4}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={savingNote || !canEditNotes}
                className="text-xs sm:text-sm bg-background resize-none leading-relaxed min-h-[100px]"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Cette note est enregistrée en temps réel et consultable par l'administrateur.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between gap-2 pt-2 border-t border-border/60 sm:space-x-0">
            {editingProspect?.notes && canEditNotes ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeleteNote}
                disabled={savingNote}
                className="text-xs text-destructive hover:bg-destructive/10 h-8 px-2"
              >
                <Trash2 className="size-3.5 mr-1" />
                Effacer
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingProspect(null)}
                disabled={savingNote}
                className="text-xs h-8 px-3 rounded-lg"
              >
                Annuler
              </Button>
              {canEditNotes && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="text-xs h-8 px-3 font-semibold gap-1.5 rounded-lg bg-primary"
                >
                  {savingNote ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Enregistrer
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Composant de ligne Prospect individuel ─────────────────────────────────────

function ProspectRow({
  prospect,
  enableSelection,
  isSelected,
  onToggleSelect,
  canEditStatus,
  canEditFinale,
  canEditNotes = true,
  onOpenNote,
  onStatusChange,
  onFinaleChange,
  showProspectorColumn,
  indent = false,
}: {
  prospect: Prospect;
  enableSelection: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  canEditStatus: boolean;
  canEditFinale: boolean;
  canEditNotes?: boolean;
  onOpenNote: (prospect: Prospect) => void;
  onStatusChange?: (id: string, s: ProspectStatus) => void;
  onFinaleChange?: (id: string, f: ProspectFinale) => void;
  showProspectorColumn: boolean;
  indent?: boolean;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingFinale, setUpdatingFinale] = useState(false);

  const handleStatusSelect = async (newVal: string) => {
    if (!onStatusChange) return;
    setUpdatingStatus(true);
    try {
      await onStatusChange(prospect.id, newVal as ProspectStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFinaleSelect = async (newVal: string) => {
    if (!onFinaleChange) return;
    setUpdatingFinale(true);
    try {
      const val: ProspectFinale = newVal === "none" ? null : (newVal as "paid" | "unpaid");
      await onFinaleChange(prospect.id, val);
    } finally {
      setUpdatingFinale(false);
    }
  };

  return (
    <TableRow className={`hover:bg-surface/90 text-xs transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
      {enableSelection && (
        <TableCell className="w-12 text-center">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </TableCell>
      )}

      {/* 1. Nom du prospect */}
      <TableCell className={`min-w-[190px] ${indent ? "pl-10" : ""}`}>
        <div className="font-semibold text-foreground leading-snug break-words">
          {prospect.business_name}
        </div>
      </TableCell>

      {/* 2. Wilaya */}
      <TableCell className="min-w-[105px] whitespace-nowrap font-medium text-foreground">
        {prospect.wilaya}
      </TableCell>

      {/* 3. Commune */}
      <TableCell className="min-w-[110px] whitespace-nowrap text-muted-foreground">
        {prospect.commune || "—"}
      </TableCell>

      {/* 4. Téléphone avec WhatsApp direct */}
      <TableCell className="min-w-[130px] whitespace-nowrap">
        <div className="flex items-center justify-between gap-1 font-mono text-slate-800 dark:text-slate-100 font-semibold text-xs">
          <a
            href={prospect.phone ? `tel:${prospect.phone}` : undefined}
            className="flex items-center gap-1.5 hover:text-primary hover:underline transition-colors truncate"
            title="Appeler par téléphone"
          >
            <Phone className="size-3 text-slate-500 shrink-0" />
            <span className="truncate">{prospect.phone || "—"}</span>
          </a>
          {prospect.phone && (
            <a
              href={formatWhatsAppUrl(prospect.phone) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center size-6 rounded-md bg-[#25D366]/10 hover:bg-[#25D366] text-[#25D366] hover:text-white transition-all shrink-0 ml-1"
              title="Discuter sur WhatsApp (wa.me)"
            >
              <WhatsAppIcon className="size-3.5" />
            </a>
          )}
        </div>
      </TableCell>

      {/* 5. Activité */}
      <TableCell className="min-w-[120px] whitespace-nowrap">
        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs truncate block max-w-[150px] whitespace-nowrap" title={prospect.category || "Commerce"}>
          {prospect.category || "Commerce"}
        </span>
      </TableCell>

      {/* Commercial assigné */}
      {showProspectorColumn && (
        <TableCell className="min-w-[115px] whitespace-nowrap">
          {prospect.prospector ? (
            <Badge variant="outline" className="text-[11px] gap-1 border-primary/20 text-primary whitespace-nowrap max-w-[140px] truncate">
              <UserCheck className="size-2.5 shrink-0" />
              <span className="truncate">{prospect.prospector.full_name}</span>
            </Badge>
          ) : (
            <span className="text-muted italic text-[11px] whitespace-nowrap">Non assigné</span>
          )}
        </TableCell>
      )}

      {/* 6. STATUT (Géré exclusivement par le prospecteur) */}
      <TableCell className="min-w-[110px] whitespace-nowrap text-center">
        {canEditStatus ? (
          <Select
            value={prospect.status}
            onValueChange={handleStatusSelect}
            disabled={updatingStatus}
          >
            <SelectTrigger
              className={`h-7 w-full min-w-[100px] max-w-[125px] mx-auto text-[11px] font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
                PROSPECT_STATUS_COLORS[prospect.status] || ""
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROSPECTOR_EDITABLE_STATUSES.map((st) => (
                <SelectItem key={st.id} value={st.id} className="text-xs">
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span
            className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap border shadow-2xs max-w-[125px] truncate ${
              PROSPECT_STATUS_COLORS[prospect.status] || ""
            }`}
          >
            {PROSPECT_STATUS_LABELS[prospect.status] || prospect.status}
          </span>
        )}
      </TableCell>

      {/* 7. FINALE (Géré exclusivement par l'administrateur) */}
      <TableCell className="min-w-[110px] whitespace-nowrap text-center">
        {canEditFinale ? (
          <Select
            value={prospect.finale || "none"}
            onValueChange={handleFinaleSelect}
            disabled={updatingFinale}
          >
            <SelectTrigger
              className={`h-7 w-full min-w-[100px] max-w-[125px] mx-auto text-[11px] font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
                PROSPECT_FINALE_COLORS[prospect.finale || "none"]
              }`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">En attente (Vide)</SelectItem>
              <SelectItem value="paid" className="text-emerald-600 font-semibold">
                Payé
              </SelectItem>
              <SelectItem value="unpaid" className="text-rose-600 font-semibold">
                Non payé
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border shadow-2xs whitespace-nowrap ${
                PROSPECT_FINALE_COLORS[prospect.finale || "none"]
              }`}
            >
              {PROSPECT_FINALE_LABELS[prospect.finale || "none"]}
            </span>
            <Lock className="size-3 text-muted shrink-0" title="Modifiable uniquement par l'administrateur" />
          </div>
        )}
      </TableCell>

      {/* 8. NOTE (Informations, remarques de visite ou d'appel) */}
      <TableCell className="min-w-[125px] whitespace-nowrap">
        {prospect.notes ? (
          <button
            type="button"
            onClick={() => onOpenNote(prospect)}
            className="group flex items-center gap-1.5 text-left px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/20 transition-all max-w-[150px] w-full"
            title={prospect.notes}
          >
            <FileText className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[11px] font-medium truncate flex-1">{prospect.notes}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenNote(prospect)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-surface-muted px-2 py-1 rounded-lg transition-colors border border-dashed border-border/70"
            title="Ajouter une note pour ce prospect"
          >
            <Plus className="size-3" />
            <span>Note</span>
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Composant Carte Mobile (Zéro Scroll Horizontal - Spécial Smartphone) ────────

function ProspectMobileCard({
  prospect,
  enableSelection,
  isSelected,
  onToggleSelect,
  canEditStatus,
  canEditFinale,
  canEditNotes = true,
  onOpenNote,
  onStatusChange,
  onFinaleChange,
  showProspectorColumn,
}: {
  prospect: Prospect;
  enableSelection: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  canEditStatus: boolean;
  canEditFinale: boolean;
  canEditNotes?: boolean;
  onOpenNote: (prospect: Prospect) => void;
  onStatusChange?: (id: string, s: ProspectStatus) => void;
  onFinaleChange?: (id: string, f: ProspectFinale) => void;
  showProspectorColumn: boolean;
}) {
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingFinale, setUpdatingFinale] = useState(false);

  const handleStatusSelect = async (newVal: string) => {
    if (!onStatusChange) return;
    setUpdatingStatus(true);
    try {
      await onStatusChange(prospect.id, newVal as ProspectStatus);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFinaleSelect = async (newVal: string) => {
    if (!onFinaleChange) return;
    setUpdatingFinale(true);
    try {
      const val: ProspectFinale = newVal === "none" ? null : (newVal as "paid" | "unpaid");
      await onFinaleChange(prospect.id, val);
    } finally {
      setUpdatingFinale(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border p-3 transition-all shadow-xs space-y-2.5 w-full overflow-hidden ${
        isSelected
          ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
          : "bg-surface border-border/80 hover:border-primary/30"
      }`}
    >
      {/* Ligne 1 : Nom du commerce + Sélection + Badge Activité */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {enableSelection && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelect}
              className="mt-0.5 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-foreground leading-snug break-words">
              {prospect.business_name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium mt-0.5">
              <MapPin className="size-3 text-slate-500 shrink-0" />
              <span className="truncate">
                {prospect.wilaya} {prospect.commune ? `• ${prospect.commune}` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Badge Activité */}
        <span className="text-[11px] font-semibold shrink-0 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-full max-w-[120px] truncate">
          {prospect.category || "Commerce"}
        </span>
      </div>

      {/* Ligne 2 : Sélecteurs Statut & Finale directement accessibles */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
        {/* Statut (Prospecteur) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Statut
          </label>
          {canEditStatus ? (
            <Select
              value={prospect.status}
              onValueChange={handleStatusSelect}
              disabled={updatingStatus}
            >
              <SelectTrigger
                className={`h-8 text-xs font-bold border rounded-xl w-full ${
                  PROSPECT_STATUS_COLORS[prospect.status] || "bg-surface"
                }`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROSPECTOR_EDITABLE_STATUSES.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs font-semibold">
                    {PROSPECT_STATUS_LABELS[st.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge
              variant="outline"
              className={`text-xs font-bold w-full justify-center h-8 rounded-xl ${
                PROSPECT_STATUS_COLORS[prospect.status]
              }`}
            >
              {PROSPECT_STATUS_LABELS[prospect.status] || prospect.status}
            </Badge>
          )}
        </div>

        {/* Finale (Admin ou Lecture seule) */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
            Décision Finale
          </label>
          {canEditFinale ? (
            <Select
              value={prospect.finale || "none"}
              onValueChange={handleFinaleSelect}
              disabled={updatingFinale}
            >
              <SelectTrigger
                className={`h-8 text-xs font-bold border rounded-xl w-full ${
                  prospect.finale ? PROSPECT_FINALE_COLORS[prospect.finale] : "bg-surface"
                }`}
              >
                <SelectValue placeholder="En attente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">En attente</SelectItem>
                <SelectItem value="paid" className="text-emerald-700 font-bold">Payé</SelectItem>
                <SelectItem value="unpaid" className="text-rose-700 font-bold">Non payé</SelectItem>
              </SelectContent>
            </Select>
          ) : prospect.finale ? (
            <Badge
              variant="outline"
              className={`text-xs font-bold w-full justify-center h-8 rounded-xl ${
                PROSPECT_FINALE_COLORS[prospect.finale]
              }`}
            >
              {PROSPECT_FINALE_LABELS[prospect.finale]}
            </Badge>
          ) : (
            <div className="h-8 flex items-center justify-center rounded-xl bg-surface border border-dashed border-border/70 text-[11px] text-muted font-medium">
              En attente
            </div>
          )}
        </div>
      </div>

      {/* Ligne 3 : Boutons Appel direct et WhatsApp */}
      <div className="flex items-center gap-2 pt-1">
        {prospect.phone ? (
          <>
            <a
              href={`tel:${prospect.phone}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs truncate"
            >
              <Phone className="size-3 shrink-0" />
              <span className="truncate">Appeler</span>
            </a>
            <a
              href={formatWhatsAppUrl(prospect.phone) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs active:scale-[0.98] transition-all shadow-xs shrink-0"
              title="Discuter sur WhatsApp"
            >
              <WhatsAppIcon className="size-3.5" />
              <span>WhatsApp</span>
            </a>
          </>
        ) : (
          <div className="flex-1 text-xs text-muted italic text-center py-1.5 bg-surface-muted/50 rounded-xl border border-dashed border-border/50">
            Aucun numéro renseigné
          </div>
        )}

        {showProspectorColumn && prospect.prospector && (
          <Badge variant="outline" className="text-[11px] font-semibold text-primary border-primary/20 shrink-0">
            <UserCheck className="size-3 mr-1" />
            {prospect.prospector.full_name}
          </Badge>
        )}
      </div>

      {/* 8. Note personnelle mobile */}
      {prospect.notes ? (
        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-amber-500/5 p-2.5 rounded-xl border border-amber-500/20 break-words flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <strong className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 mb-0.5">
              <FileText className="size-3" /> Note :
            </strong>
            <p className="whitespace-pre-wrap leading-relaxed">{prospect.notes}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenNote(prospect)}
            className="h-6 px-1.5 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 shrink-0 font-semibold"
          >
            Modifier
          </Button>
        </div>
      ) : (
        <div className="pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenNote(prospect)}
            className="w-full h-7 text-[11px] text-muted-foreground hover:text-foreground border-dashed gap-1"
          >
            <Plus className="size-3" />
            Ajouter une note personnelle
          </Button>
        </div>
      )}
    </div>
  );
}

