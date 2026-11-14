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
import { useMemo, useState } from "react";

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
  defaultHierarchical = true,
}: HierarchicalProspectsTableProps) {
  // Filtres
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState("all");
  const [selectedCommune, setSelectedCommune] = useState("all");
  const [selectedActivity, setSelectedActivity] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedFinale, setSelectedFinale] = useState("all");
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

      return matchSearch && matchWilaya && matchCommune && matchActivity && matchStatus && matchFinale;
    });
  }, [
    prospects,
    searchTerm,
    selectedWilaya,
    selectedCommune,
    selectedActivity,
    selectedStatus,
    selectedFinale,
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
            <SelectTrigger className="h-8 text-xs bg-surface">
              <SelectValue placeholder="Résultat Finale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes (Finale)</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="unpaid">Non payé</SelectItem>
              <SelectItem value="none">En attente (Vide)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Barre d'état & actions de groupe */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted px-1">
        <div className="flex items-center gap-2">
          <span>
            Total : <strong>{filteredProspects.length}</strong> prospect(s) affiché(s) sur{" "}
            {prospects.length}
          </span>
          {enableSelection && selectedIds.length > 0 && (
            <span className="font-semibold text-primary">
              • {selectedIds.length} sélectionné(s)
            </span>
          )}
        </div>

        {isHierarchicalView && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="text-primary hover:underline"
            >
              Tout déplier
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="text-muted hover:text-foreground hover:underline"
            >
              Tout replier
            </button>
          </div>
        )}
      </div>

      {/* Rendu du tableau */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-surface/90">
            <TableRow>
              {enableSelection && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filteredProspects.length > 0 &&
                      selectedIds.length === filteredProspects.length
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>1. Nom du prospect</TableHead>
              <TableHead>2. Wilaya</TableHead>
              <TableHead>3. Commune</TableHead>
              <TableHead>4. Téléphone</TableHead>
              <TableHead>5. Activité</TableHead>
              {showProspectorColumn && <TableHead>Commercial</TableHead>}
              <TableHead className="w-36">6. Statut</TableHead>
              <TableHead className="w-36">7. Finale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProspects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-36 text-center text-muted">
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
                  <tbody key={`w-${wilayaName}`} className="border-b border-border/60">
                    {/* LIGNE HEADER WILAYA */}
                    <tr className="bg-surface/90 hover:bg-surface font-semibold text-foreground text-sm cursor-pointer select-none">
                      <td
                        colSpan={enableSelection ? 9 : 8}
                        className="p-3"
                        onClick={() => toggleWilaya(wilayaName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isWilayaExpanded ? (
                              <ChevronDown className="size-4 text-primary" />
                            ) : (
                              <ChevronRight className="size-4 text-muted" />
                            )}
                            <MapPin className="size-4 text-primary shrink-0" />
                            <span>Wilaya : {wilayaName}</span>
                          </div>
                          <Badge variant="secondary" className="font-mono text-xs">
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
                          <tbody key={`c-${communeKey}`}>
                            {/* LIGNE HEADER COMMUNE */}
                            <tr className="bg-surface/40 hover:bg-surface/60 text-xs font-medium cursor-pointer select-none">
                              <td
                                colSpan={enableSelection ? 9 : 8}
                                className="py-2 px-8"
                                onClick={() => toggleCommune(communeKey)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isCommuneExpanded ? (
                                      <ChevronDown className="size-3.5 text-muted" />
                                    ) : (
                                      <ChevronRight className="size-3.5 text-muted" />
                                    )}
                                    <span className="text-foreground">
                                      Commune : {communeName}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-muted">
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
                          </tbody>
                        );
                      })}
                  </tbody>
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
          </TableBody>
        </Table>

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
    <TableRow className={`hover:bg-surface/90 text-xs ${isSelected ? "bg-primary/5" : ""}`}>
      {enableSelection && (
        <TableCell>
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </TableCell>
      )}

      {/* 1. Nom du prospect */}
      <TableCell className={indent ? "pl-12" : ""}>
        <div className="font-semibold text-foreground">{prospect.business_name}</div>
        {prospect.notes && (
          <div className="text-[11px] text-muted truncate max-w-xs">{prospect.notes}</div>
        )}
      </TableCell>

      {/* 2. Wilaya */}
      <TableCell>{prospect.wilaya}</TableCell>

      {/* 3. Commune */}
      <TableCell>{prospect.commune || "—"}</TableCell>

      {/* 4. Téléphone */}
      <TableCell>
        <div className="flex items-center gap-1.5 font-mono text-foreground">
          <Phone className="size-3 text-muted" />
          <span>{prospect.phone}</span>
        </div>
      </TableCell>

      {/* 5. Activité */}
      <TableCell>
        <span className="text-muted-foreground">{prospect.category || "Commerce"}</span>
      </TableCell>

      {/* Commercial assigné */}
      {showProspectorColumn && (
        <TableCell>
          {prospect.prospector ? (
            <Badge variant="outline" className="text-[11px] gap-1 border-primary/20 text-primary">
              <UserCheck className="size-2.5" />
              {prospect.prospector.full_name}
            </Badge>
          ) : (
            <span className="text-muted italic text-[11px]">Non assigné</span>
          )}
        </TableCell>
      )}

      {/* 6. STATUT (Géré exclusivement par le prospecteur) */}
      <TableCell>
        {canEditStatus ? (
          <Select
            value={prospect.status}
            onValueChange={handleStatusSelect}
            disabled={updatingStatus}
          >
            <SelectTrigger
              className={`h-7 text-[11px] font-medium rounded-full ${
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
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              PROSPECT_STATUS_COLORS[prospect.status] || ""
            }`}
          >
            {PROSPECT_STATUS_LABELS[prospect.status] || prospect.status}
          </span>
        )}
      </TableCell>

      {/* 7. FINALE (Géré exclusivement par l'administrateur) */}
      <TableCell>
        {canEditFinale ? (
          <Select
            value={prospect.finale || "none"}
            onValueChange={handleFinaleSelect}
            disabled={updatingFinale}
          >
            <SelectTrigger
              className={`h-7 text-[11px] font-medium rounded-full ${
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
          <div className="flex items-center gap-1">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
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

