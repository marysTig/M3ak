import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Trophy,
  Medal,
  User,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  createProspector,
  deleteProspector,
  getProspectors,
  resetProspectorPassword,
  updateProspectorStatus,
} from "@/lib/db/prospectors";
import type { Prospector } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/team")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tab: (search.tab as string) || "all",
      prospectorId: (search.prospectorId as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Équipe Commerciale — M3ak CRM" },
      { name: "description", content: "Création et gestion des prospecteurs par username et mot de passe." },
    ],
  }),
  component: ProspectorsTeamPage,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};

function generateSecurePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "M3ak@";
  for (let i = 0; i < 6; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}

function ProspectorsTeamPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const activeTab = (searchParams.tab as string) || "all";

  const [prospectors, setProspectors] = useState<Prospector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWilaya, setSelectedWilaya] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Formulaire d'ajout (SANS AUCUN EMAIL)
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [password, setPassword] = useState(generateSecurePassword());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<{
    username: string;
    password: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Modale réinitialisation mot de passe
  const [resetModalUser, setResetModalUser] = useState<Prospector | null>(null);
  const [newPasswordForReset, setNewPasswordForReset] = useState(generateSecurePassword());
  const [resetting, setResetting] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Recherche dans le sélecteur des 69 wilayas
  const [wilayaSearch, setWilayaSearch] = useState("");
  const filteredWilayasList = useMemo(() => {
    if (!wilayaSearch.trim()) return ALGERIA_WILAYAS;
    const s = wilayaSearch.toLowerCase();
    return ALGERIA_WILAYAS.filter(
      (w) => w.name.toLowerCase().includes(s) || w.code.includes(s)
    );
  }, [wilayaSearch]);

  // Classement officiel des prospecteurs (ordonné par conversions/payés, puis essais gratuits, puis total assigné)
  const rankedProspectors = useMemo(() => {
    return [...prospectors].sort((a, b) => {
      const convA = a.conversions_count || 0;
      const convB = b.conversions_count || 0;
      if (convB !== convA) return convB - convA;

      const trialA = a.active_trials_count || 0;
      const trialB = b.active_trials_count || 0;
      if (trialB !== trialA) return trialB - trialA;

      const assA = a.assigned_count || 0;
      const assB = b.assigned_count || 0;
      return assB - assA;
    });
  }, [prospectors]);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getProspectors();
      setProspectors(data);
    } catch (err) {
      console.error("Erreur chargement prospecteurs :", err);
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

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    const conf = window.confirm(
      nextStatus === "suspended"
        ? "Voulez-vous suspendre l'accès de ce prospecteur ?"
        : "Voulez-vous réactiver l'accès de ce prospecteur ?"
    );
    if (!conf) return;

    const ok = await updateProspectorStatus(id, nextStatus as "active" | "suspended");
    if (ok) {
      setProspectors((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: nextStatus as "active" | "suspended" } : p))
      );
    }
  };

  const handleDeleteProspector = async (id: string, name: string) => {
    const conf = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement le prospecteur "${name}" ?\n\nTous les commerces qui lui étaient assignés redeviendront non-assignés.`
    );
    if (!conf) return;

    const res = await deleteProspector(id);
    if (res.success) {
      setProspectors((prev) => prev.filter((p) => p.id !== id));
      toast.success(`Le prospecteur "${name}" a été supprimé avec succès.`);
    } else {
      toast.error(res.error || "Impossible de supprimer ce prospecteur.");
    }
  };

  const handleCreateProspector = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim() || !username.trim() || !phone.trim() || !wilaya) {
      setFormError("Veuillez renseigner les champs obligatoires (Nom, Nom d'utilisateur, Téléphone, Wilaya).");
      return;
    }
    if (password.length < 6) {
      setFormError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createProspector({
        full_name: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        wilaya,
        commune: commune.trim() || undefined,
        password,
        notes: notes.trim() || undefined,
      });

      if (!res.success) {
        setFormError(res.error || "Impossible de créer le prospecteur.");
        return;
      }

      setCreatedSuccess({
        username: username.trim(),
        password,
        name: fullName.trim(),
      });

      setFullName("");
      setUsername("");
      setPhone("");
      setWilaya("");
      setCommune("");
      setPassword(generateSecurePassword());
      setNotes("");

      loadData();
    } catch (err: any) {
      setFormError(err?.message || "Une erreur inattendue est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdSuccess) return;
    const text = `Identifiants Commercial M3ak :\nNom : ${createdSuccess.name}\nNom d'utilisateur : ${createdSuccess.username}\nMot de passe : ${createdSuccess.password}\nEspace Commercial : ${window.location.origin}/prospector`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExecutePasswordReset = async () => {
    if (!resetModalUser || !newPasswordForReset) return;
    setResetting(true);
    try {
      const res = await resetProspectorPassword(resetModalUser.username, newPasswordForReset);
      if (res.success) {
        setResetSuccessMessage(
          `Nouveau mot de passe pour ${resetModalUser.username} : ${newPasswordForReset}`
        );
      } else {
        alert(res.error || "Erreur réinitialisation");
      }
    } finally {
      setResetting(false);
    }
  };

  // Filtrage
  const filteredProspectors = useMemo(() => {
    return prospectors.filter((p) => {
      const matchSearch =
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.wilaya?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchWilaya = selectedWilaya === "all" || p.wilaya === selectedWilaya;
      const matchStatus = selectedStatus === "all" || p.status === selectedStatus;
      return matchSearch && matchWilaya && matchStatus;
    });
  }, [prospectors, searchTerm, selectedWilaya, selectedStatus]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Équipe Commerciale"
        description="Gérez les comptes d'accès des prospecteurs (username & mot de passe sans email) et suivez leurs statistiques de terrain."
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
              size="sm"
              className="gap-2"
              onClick={() => handleTabChange("new")}
            >
              <UserPlus className="size-4" />
              Nouveau prospecteur
            </Button>
          </div>
        }
      />

      {/* Cartes KPI globales de l'équipe */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Prospecteurs actifs"
          value={`${prospectors.filter((p) => p.status === "active").length} / ${prospectors.length}`}
          icon={Users}
        />
        <StatCard
          label="Prospects affectés"
          value={prospectors.reduce((acc, p) => acc + (p.assigned_count || 0), 0).toLocaleString()}
          icon={MapPin}
        />
        <StatCard
          label="Essais 7j lancés"
          value={prospectors.reduce((acc, p) => acc + (p.active_trials_count || 0), 0).toLocaleString()}
          icon={TrendingUp}
        />
        <StatCard
          label="Commissions versées"
          value={`${prospectors.reduce((acc, p) => acc + (p.total_commission_da || 0), 0).toLocaleString()} DA`}
          icon={ShieldCheck}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all" className="gap-2">
            <Users className="size-4" />
            Tous ({prospectors.length})
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            <UserPlus className="size-4" />
            Ajouter un prospecteur
          </TabsTrigger>
          <TabsTrigger value="perf" className="gap-2">
            <TrendingUp className="size-4" />
            Performances
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TOUS LES PROSPECTEURS */}
        <TabsContent value="all" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Rechercher par nom, username, téléphone, wilaya..."
                className="pl-9 bg-surface"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedWilaya} onValueChange={setSelectedWilaya}>
                <SelectTrigger className="w-48 bg-surface">
                  <SelectValue placeholder="Toutes wilayas (69)" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Toutes wilayas (69)</SelectItem>
                  {ALGERIA_WILAYAS.map((w) => (
                    <SelectItem key={w.code} value={w.name}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-36 bg-surface">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-surface/90">
                <TableRow>
                  <TableHead>Prospecteur</TableHead>
                  <TableHead>Nom d'utilisateur</TableHead>
                  <TableHead>Wilaya d'affectation</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Prospects</TableHead>
                  <TableHead className="text-center">Essais 7j</TableHead>
                  <TableHead className="text-center">Conversions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted">
                      <RefreshCw className="size-5 animate-spin mx-auto mb-2" />
                      Chargement des prospecteurs...
                    </TableCell>
                  </TableRow>
                ) : filteredProspectors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-36 text-center text-muted">
                      Aucun prospecteur trouvé.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspectors.map((p) => (
                    <TableRow key={p.id} className="hover:bg-surface/90 text-xs">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 border border-border">
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {p.full_name?.substring(0, 2).toUpperCase() || "C"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="font-semibold text-foreground text-sm">{p.full_name}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <code className="bg-surface/90 px-2 py-0.5 rounded border border-border/60 text-primary font-mono font-medium">
                          @{p.username}
                        </code>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3 text-muted shrink-0" />
                          <span>{p.wilaya || "Algérie"}</span>
                          {p.commune && <span className="text-muted">({p.commune})</span>}
                        </div>
                      </TableCell>

                      <TableCell className="font-mono">{p.phone || "—"}</TableCell>

                      <TableCell>
                        {p.status === "active" ? (
                          <StatusBadge status="active" label="Actif" />
                        ) : (
                          <StatusBadge status="expired" label="Suspendu" />
                        )}
                      </TableCell>

                      <TableCell className="text-center font-bold">{p.assigned_count || 0}</TableCell>
                      <TableCell className="text-center text-purple-600 font-semibold">
                        {p.active_trials_count || 0}
                      </TableCell>
                      <TableCell className="text-center text-emerald-600 font-bold">
                        {p.conversions_count || 0}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            asChild
                            title="Voir les prospects de ce commercial"
                          >
                            <Link
                              to="/admin/prospection/prospects"
                              search={{ tab: "all", prospectorId: p.id }}
                            >
                              <Eye className="size-3.5" />
                              Listes
                            </Link>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-amber-500 hover:text-amber-600 gap-1"
                            onClick={() => {
                              setResetModalUser(p);
                              setNewPasswordForReset(generateSecurePassword());
                              setResetSuccessMessage(null);
                            }}
                            title="Réinitialiser le mot de passe"
                          >
                            <KeyRound className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 text-xs gap-1 ${
                              p.status === "active"
                                ? "text-rose-500 hover:text-rose-600"
                                : "text-emerald-500 hover:text-emerald-600"
                            }`}
                            onClick={() => handleToggleStatus(p.id, p.status)}
                            title={p.status === "active" ? "Suspendre l'accès" : "Réactiver le compte"}
                          >
                            {p.status === "active" ? (
                              <UserX className="size-3.5" />
                            ) : (
                              <UserCheck className="size-3.5" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1"
                            onClick={() => handleDeleteProspector(p.id, p.full_name)}
                            title="Supprimer définitivement le prospecteur"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TAB 2: AJOUTER UN PROSPECTEUR (SANS EMAIL) */}
        <TabsContent value="new" className="space-y-6">
          {createdSuccess && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-emerald-950 dark:text-emerald-100">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="size-6 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold text-lg">Compte prospecteur créé avec succès !</h4>
                  <p className="text-sm text-muted-foreground">
                    Le prospecteur se connecte directement avec son <strong>Nom d'utilisateur</strong> et son <strong>Mot de passe</strong> (aucun email requis).
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-500/30 bg-surface/90 p-4 font-mono text-sm space-y-1.5">
                    <div>
                      <span className="text-muted">Nom complet :</span> <strong>{createdSuccess.name}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Nom d'utilisateur (Username) :</span>{" "}
                      <strong className="text-primary font-bold">@{createdSuccess.username}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Mot de passe initial :</span>{" "}
                      <strong className="text-amber-500">{createdSuccess.password}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Lien de connexion :</span>{" "}
                      <code className="text-xs">{window.location.origin}/prospector/login</code>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyCredentials}
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-2 bg-surface"
                  >
                    {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    {copied ? "Identifiants copiés !" : "Copier les identifiants pour le commercial"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm">
            <div className="max-w-2xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Créer un compte prospecteur commercial
                </h3>
                <p className="text-sm text-muted">
                  Renseignez son nom, son nom d'utilisateur et son mot de passe. Aucun email n'est nécessaire.
                </p>
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">
                  <AlertCircle className="size-5 shrink-0" />
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreateProspector} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname">Nom et Prénom *</Label>
                    <Input
                      id="fullname"
                      placeholder="Ex: Yacine Brahimi"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (!username) {
                          setUsername(
                            e.target.value
                              .toLowerCase()
                              .replace(/[\s]/g, ".")
                              .replace(/[^a-z0-9.]/g, "")
                          );
                        }
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="username">Nom d'utilisateur (Username) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-mono">@</span>
                      <Input
                        id="username"
                        placeholder="yacine.brahimi"
                        className="pl-8 font-mono"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                    <p className="text-[11px] text-muted">Identifiant unique utilisé pour la connexion.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Numéro de téléphone *</Label>
                    <Input
                      id="phone"
                      placeholder="0550 12 34 56"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  {/* SÉLECTEUR 69 WILAYAS AVEC RECHERCHE */}
                  <div className="space-y-1.5">
                    <Label htmlFor="wilaya">Wilaya d'affectation (69 wilayas) *</Label>
                    <Select value={wilaya} onValueChange={setWilaya}>
                      <SelectTrigger id="wilaya" className="bg-surface">
                        <SelectValue placeholder="Choisir la wilaya" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <div className="p-2 border-b border-border sticky top-0 bg-surface z-10">
                          <Input
                            placeholder="Rechercher une wilaya..."
                            className="h-8 text-xs"
                            value={wilayaSearch}
                            onChange={(e) => setWilayaSearch(e.target.value)}
                          />
                        </div>
                        {filteredWilayasList.map((w) => (
                          <SelectItem key={w.code} value={w.name}>
                            <span className="font-mono text-muted mr-1.5">{w.code}</span>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="commune">Commune / Secteur</Label>
                    <Input
                      id="commune"
                      placeholder="Ex: Kouba"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe initial *</Label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateSecurePassword())}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <KeyRound className="size-3" />
                      Générer automatiquement un mot de passe sécurisé
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="text"
                    className="font-mono text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Informations complémentaires facultatives</Label>
                  <Textarea
                    id="notes"
                    placeholder="Secteur géographique prioritaire, objectifs..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {submitting ? "Création en cours..." : "Créer le prospecteur"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: PERFORMANCES & CLASSEMENT */}
        <TabsContent value="perf" className="space-y-6">
          {/* EN-TÊTE DE LA SECTION PERFORMANCES */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                Classement & Performances de l'Équipe Commerciale
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                Classement officiel basé sur les commerces payés (clients convertis), les essais gratuits 7 jours et le total attribué.
              </p>
            </div>
          </div>

          {/* PODIUM / TOP 3 */}
          {rankedProspectors.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1ère Place */}
              {rankedProspectors[0] && (
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/10 via-surface/80 to-surface p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
                      <Trophy className="size-3.5" /> 1ère Place (Leader)
                    </span>
                    <span className="text-2xl">🥇</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar className="size-12 border-2 border-amber-400">
                      <AvatarFallback className="bg-amber-100 text-amber-800 font-bold text-base">
                        {rankedProspectors[0].full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                        {rankedProspectors[0].full_name}
                      </div>
                      <div className="text-xs text-primary font-mono font-medium">
                        @{rankedProspectors[0].username}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-center">
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        {rankedProspectors[0].conversions_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Payés
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                        {rankedProspectors[0].active_trials_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Essais 7j
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {rankedProspectors[0].assigned_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Attribués
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2ème Place */}
              {rankedProspectors[1] && (
                <div className="relative overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-gradient-to-b from-slate-200/40 dark:from-slate-800/40 via-surface/80 to-surface p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-500 text-white shadow-sm">
                      <Medal className="size-3.5" /> 2ème Place
                    </span>
                    <span className="text-2xl">🥈</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar className="size-12 border-2 border-slate-400">
                      <AvatarFallback className="bg-slate-200 text-slate-800 font-bold text-base">
                        {rankedProspectors[1].full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                        {rankedProspectors[1].full_name}
                      </div>
                      <div className="text-xs text-primary font-mono font-medium">
                        @{rankedProspectors[1].username}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-center">
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        {rankedProspectors[1].conversions_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Payés
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                        {rankedProspectors[1].active_trials_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Essais 7j
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {rankedProspectors[1].assigned_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Attribués
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3ème Place */}
              {rankedProspectors[2] && (
                <div className="relative overflow-hidden rounded-2xl border border-amber-600/30 bg-gradient-to-b from-amber-700/10 via-surface/80 to-surface p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-700 text-white shadow-sm">
                      <Medal className="size-3.5" /> 3ème Place
                    </span>
                    <span className="text-2xl">🥉</span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Avatar className="size-12 border-2 border-amber-600">
                      <AvatarFallback className="bg-amber-200 text-amber-900 font-bold text-base">
                        {rankedProspectors[2].full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                        {rankedProspectors[2].full_name}
                      </div>
                      <div className="text-xs text-primary font-mono font-medium">
                        @{rankedProspectors[2].username}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-center">
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                        {rankedProspectors[2].conversions_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Payés
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                        {rankedProspectors[2].active_trials_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Essais 7j
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/80 p-2 border border-border/50">
                      <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                        {rankedProspectors[2].assigned_count || 0}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Attribués
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TABLEAU COMPLET DU CLASSEMENT */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-border/60 bg-surface/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award className="size-4 text-primary" />
                  Tableau de Classement Détaillé
                </h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Liste ordonnée de tous les prospecteurs avec le nombre d'essais gratuits et de commerces payés dans leur liste.
                </p>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-surface/90">
                  <TableRow>
                    <TableHead className="w-16 text-center font-bold text-slate-900 dark:text-slate-100">Rang</TableHead>
                    <TableHead className="font-bold text-slate-900 dark:text-slate-100">Nom & Prénom</TableHead>
                    <TableHead className="font-bold text-slate-900 dark:text-slate-100">Wilaya</TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-slate-100">Dans sa liste</TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-slate-100">Essais Gratuits</TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-slate-100">Payés (Convertis)</TableHead>
                    <TableHead className="text-center font-bold text-slate-900 dark:text-slate-100">Taux Réussite</TableHead>
                    <TableHead className="text-right font-bold text-slate-900 dark:text-slate-100">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-700 dark:text-slate-300">
                        <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                        Chargement du classement...
                      </TableCell>
                    </TableRow>
                  ) : rankedProspectors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center text-slate-700 dark:text-slate-300">
                        Aucun commercial enregistré pour le moment.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rankedProspectors.map((p, index) => {
                      const rank = index + 1;
                      const conversionRate =
                        (p.assigned_count || 0) > 0
                          ? (((p.conversions_count || 0) / (p.assigned_count || 1)) * 100).toFixed(1)
                          : "0.0";

                      return (
                        <TableRow
                          key={p.id}
                          className={`hover:bg-surface/90 text-xs transition-colors ${
                            rank === 1
                              ? "bg-amber-500/5 font-medium"
                              : rank === 2
                              ? "bg-slate-400/5 font-medium"
                              : rank === 3
                              ? "bg-amber-700/5 font-medium"
                              : ""
                          }`}
                        >
                          {/* Rang */}
                          <TableCell className="text-center font-bold">
                            {rank === 1 ? (
                              <span className="inline-flex items-center justify-center size-7 rounded-full bg-amber-500 text-white font-extrabold text-xs shadow-sm">
                                🥇
                              </span>
                            ) : rank === 2 ? (
                              <span className="inline-flex items-center justify-center size-7 rounded-full bg-slate-400 text-white font-extrabold text-xs shadow-sm">
                                🥈
                              </span>
                            ) : rank === 3 ? (
                              <span className="inline-flex items-center justify-center size-7 rounded-full bg-amber-700 text-white font-extrabold text-xs shadow-sm">
                                🥉
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center size-7 rounded-full bg-surface border border-border text-slate-800 dark:text-slate-200 font-bold text-xs">
                                #{rank}
                              </span>
                            )}
                          </TableCell>

                          {/* Nom et Prénom */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <Avatar className="size-8 border border-border/80">
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                  {p.full_name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                  {p.full_name}
                                </div>
                                <code className="text-[11px] text-primary font-mono font-medium">
                                  @{p.username}
                                </code>
                              </div>
                            </div>
                          </TableCell>

                          {/* Wilaya */}
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-medium">
                              <MapPin className="size-3 text-muted shrink-0" />
                              <span>{p.wilaya || "Algérie"}</span>
                              {p.commune && <span className="text-muted text-[11px]">({p.commune})</span>}
                            </div>
                          </TableCell>

                          {/* Total dans sa liste */}
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {p.assigned_count || 0}
                            </span>
                          </TableCell>

                          {/* Essais gratuits */}
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {p.active_trials_count || 0}
                            </span>
                          </TableCell>

                          {/* Payés */}
                          <TableCell className="text-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {p.conversions_count || 0}
                            </span>
                          </TableCell>

                          {/* Taux de réussite */}
                          <TableCell className="text-center font-bold text-slate-800 dark:text-slate-200">
                            {conversionRate}%
                          </TableCell>

                          {/* Action */}
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                              asChild
                              title={`Voir la liste de ${p.full_name}`}
                            >
                              <Link
                                to="/admin/prospection/prospects"
                                search={{ tab: "all", prospectorId: p.id }}
                              >
                                <Eye className="size-3.5" />
                                Voir sa liste
                              </Link>
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

          {/* GRAPHIQUE COMPARATIF VISUEL */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Graphique Comparatif des Volumes
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Comparaison graphique des commerces attribués, essais gratuits et payés par commercial.
            </p>

            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rankedProspectors.map((p) => ({
                    name: p.full_name,
                    prospects: p.assigned_count || 0,
                    essais: p.active_trials_count || 0,
                    conversions: p.conversions_count || 0,
                  }))}
                  margin={{ top: 10, right: 30, left: 0, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--color-muted)"
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                    fontSize={11}
                  />
                  <YAxis stroke="var(--color-muted)" tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: "10px" }} />
                  <Bar dataKey="prospects" fill="#3b82f6" name="Commerces dans sa liste" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="essais" fill="#8b5cf6" name="Essais gratuits" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" fill="#10b981" name="Payés (Clients convertis)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODALE RÉINITIALISATION MOT DE PASSE */}
      <Dialog open={!!resetModalUser} onOpenChange={(open) => !open && setResetModalUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-amber-500" />
              Réinitialiser le mot de passe
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau mot de passe pour <strong>{resetModalUser?.full_name}</strong> (@{resetModalUser?.username}).
            </DialogDescription>
          </DialogHeader>

          {resetSuccessMessage ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-mono space-y-2">
              <div className="font-semibold text-emerald-600">Mot de passe réinitialisé !</div>
              <div>{resetSuccessMessage}</div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newPasswordForReset);
                  alert("Mot de passe copié !");
                }}
              >
                Copier le mot de passe
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="newpass">Nouveau mot de passe</Label>
                  <button
                    type="button"
                    onClick={() => setNewPasswordForReset(generateSecurePassword())}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Régénérer
                  </button>
                </div>
                <Input
                  id="newpass"
                  type="text"
                  className="font-mono text-sm"
                  value={newPasswordForReset}
                  onChange={(e) => setNewPasswordForReset(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetModalUser(null)}>
              Fermer
            </Button>
            {!resetSuccessMessage && (
              <Button
                onClick={handleExecutePasswordReset}
                disabled={resetting || !newPasswordForReset}
                className="gap-2"
              >
                {resetting ? <RefreshCw className="size-4 animate-spin" /> : <Lock className="size-4" />}
                Valider le mot de passe
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
