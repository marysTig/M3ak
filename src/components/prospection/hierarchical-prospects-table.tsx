import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  Lock,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
} from "lucide-react";
import React, { Fragment, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { ALGERIA_WILAYAS } from "@/lib/constants/algeria-wilayas";
import type { Prospect, ProspectFinale, ProspectStatus } from "@/lib/types/prospection";
import {
  PROSPECTOR_EDITABLE_STATUSES,
  PROSPECT_FINALE_COLORS,
  PROSPECT_FINALE_LABELS,
  PROSPECT_STATUS_COLORS,
  PROSPECT_STATUS_LABELS,
} from "@/lib/types/prospection";

interface HierarchicalProspectsTableProps {
  prospects: Prospect[];
  canEditStatus?: boolean; // Prospecteur ou Admin
  canEditFinale?: boolean; // STRICTEMENT Admin
  onStatusChange?: (prospectId: string, status: ProspectStatus) => Promise<void> | void;
  onFinaleChange?: (prospectId: string, finale: ProspectFinale) => Promise<void> | void;
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
  onStatusChange,
  onFinaleChange,
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

  // Extraction unique des communes et activités pour les filtres
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach((p) => {
      if (p.commune && (selectedWilaya === "all" || p.wilaya === selectedWilaya)) {
        set.add(p.commune);
      }
    });
    return Array.from(set).sort();
  }, [prospects, selectedWilaya]);

  const availableActivities = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [prospects]);

  const availableProspectors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    prospects.forEach((p) => {
      if (p.assigned_to && p.prospector) {
        map.set(p.assigned_to, {
          id: p.assigned_to,
          name: p.prospector.full_name || p.prospector.username || "Commercial",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [prospects]);

  // Filtrage
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchSearch =
        !searchTerm.trim() ||
        p.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.commune?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.wilaya?.toLowerCase().includes(searchTerm.toLowerCase());

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
    prospects,
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
                onStatusChange={onStatusChange}
                onFinaleChange={onFinaleChange}
                showProspectorColumn={showProspectorColumn}
              />
            ))
          )}
        </div>

        {/* ─── VUE DESKTOP : TABLEAU COMPLET (hidden md:block) ─── */}
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full min-w-[820px] table-fixed caption-bottom text-sm border-collapse">
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
                <TableHead className="min-w-[190px] w-[24%]">1. Nom du prospect</TableHead>
                <TableHead className="min-w-[105px] w-[12%] whitespace-nowrap">2. Wilaya</TableHead>
                <TableHead className="min-w-[110px] w-[13%] whitespace-nowrap">3. Commune</TableHead>
                <TableHead className="min-w-[120px] w-[13%] whitespace-nowrap">4. Téléphone</TableHead>
                <TableHead className="min-w-[125px] w-[14%] whitespace-nowrap">5. Activité</TableHead>
                {showProspectorColumn && (
                  <TableHead className="min-w-[120px] w-[12%] whitespace-nowrap">Commercial</TableHead>
                )}
                <TableHead className="min-w-[115px] w-[12%] whitespace-nowrap text-center">6. Statut</TableHead>
                <TableHead className="min-w-[115px] w-[12%] whitespace-nowrap text-center">7. Finale</TableHead>
              </TableRow>
            </thead>
            <tbody>
              {filteredProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={enableSelection ? (showProspectorColumn ? 9 : 8) : (showProspectorColumn ? 8 : 7)} className="h-36 text-center text-muted">
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
                          colSpan={enableSelection ? (showProspectorColumn ? 9 : 8) : (showProspectorColumn ? 8 : 7)}
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
                                  colSpan={enableSelection ? (showProspectorColumn ? 9 : 8) : (showProspectorColumn ? 8 : 7)}
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
      <TableCell className={`min-w-[220px] ${indent ? "pl-10" : ""}`}>
        <div className="font-semibold text-foreground leading-snug break-words">
          {prospect.business_name}
        </div>
        {prospect.notes && (
          <div className="text-[11px] text-muted truncate max-w-[200px]" title={prospect.notes}>
            {prospect.notes}
          </div>
        )}
      </TableCell>

      {/* 2. Wilaya */}
      <TableCell className="min-w-[120px] whitespace-nowrap font-medium text-foreground">
        {prospect.wilaya}
      </TableCell>

      {/* 3. Commune */}
      <TableCell className="min-w-[130px] whitespace-nowrap text-muted-foreground">
        {prospect.commune || "—"}
      </TableCell>

      {/* 4. Téléphone */}
      <TableCell className="min-w-[120px] whitespace-nowrap">
        <div className="flex items-center gap-1.5 font-mono text-slate-800 dark:text-slate-100 font-semibold text-xs">
          <Phone className="size-3 text-slate-500 shrink-0" />
          <span>{prospect.phone}</span>
        </div>
      </TableCell>

      {/* 5. Activité */}
      <TableCell className="min-w-[125px] whitespace-nowrap">
        <span className="text-slate-700 dark:text-slate-300 font-semibold text-xs truncate block max-w-[160px] whitespace-nowrap" title={prospect.category || "Commerce"}>
          {prospect.category || "Commerce"}
        </span>
      </TableCell>

      {/* Commercial assigné */}
      {showProspectorColumn && (
        <TableCell className="min-w-[120px] whitespace-nowrap">
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
      <TableCell className="min-w-[115px] whitespace-nowrap text-center">
        {canEditStatus ? (
          <Select
            value={prospect.status}
            onValueChange={handleStatusSelect}
            disabled={updatingStatus}
          >
            <SelectTrigger
              className={`h-7 w-full min-w-[105px] max-w-[130px] mx-auto text-[11px] font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
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
            className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap border shadow-2xs max-w-[130px] truncate ${
              PROSPECT_STATUS_COLORS[prospect.status] || ""
            }`}
          >
            {PROSPECT_STATUS_LABELS[prospect.status] || prospect.status}
          </span>
        )}
      </TableCell>

      {/* 7. FINALE (Géré exclusivement par l'administrateur) */}
      <TableCell className="min-w-[115px] whitespace-nowrap text-center">
        {canEditFinale ? (
          <Select
            value={prospect.finale || "none"}
            onValueChange={handleFinaleSelect}
            disabled={updatingFinale}
          >
            <SelectTrigger
              className={`h-7 w-full min-w-[105px] max-w-[130px] mx-auto text-[11px] font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
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
                  <SelectItem key={st} value={st} className="text-xs font-semibold">
                    {PROSPECT_STATUS_LABELS[st]}
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

      {/* Ligne 3 : Bouton d'appel direct en 1 clic */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {prospect.phone ? (
          <a
            href={`tel:${prospect.phone}`}
            className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs"
          >
            <Phone className="size-3.5 shrink-0" />
            <span>Appeler {prospect.phone}</span>
          </a>
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

      {prospect.notes && (
        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-surface-muted/60 p-2 rounded-lg border border-border/50 break-words">
          <strong>Note :</strong> {prospect.notes}
        </div>
      )}
    </div>
  );
}

