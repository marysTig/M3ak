import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { createProspector, getProspectors, updateProspectorStatus } from "@/lib/db/prospectors";
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
      { name: "description", content: "Gestion et suivi des performances des prospecteurs." },
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
  for (let i = 0; i < 8; i++) {
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

  // Formulaire d'ajout
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [wilaya, setWilaya] = useState("");
  const [commune, setCommune] = useState("");
  const [password, setPassword] = useState(generateSecurePassword());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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
        ? "Voulez-vous vraiment suspendre l'accès de ce prospecteur ?"
        : "Voulez-vous réactiver ce prospecteur ?"
    );
    if (!conf) return;

    const ok = await updateProspectorStatus(id, nextStatus as "active" | "suspended");
    if (ok) {
      setProspectors((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: nextStatus as "active" | "suspended" } : p))
      );
    }
  };

  const handleCreateProspector = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim() || !email.trim() || !phone.trim() || !wilaya) {
      setFormError("Veuillez remplir tous les champs obligatoires (Nom, Email, Téléphone, Wilaya).");
      return;
    }
    if (password.length < 8) {
      setFormError("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createProspector({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        wilaya,
        commune: commune.trim() || undefined,
        password,
      });

      if (!res.success) {
        setFormError(res.error || "Impossible de créer le compte prospecteur.");
        return;
      }

      setCreatedSuccess({
        email: email.trim(),
        password,
        name: fullName.trim(),
      });

      // Réinitialiser les champs
      setFullName("");
      setEmail("");
      setPhone("");
      setWilaya("");
      setCommune("");
      setPassword(generateSecurePassword());
      setNotes("");

      // Rafraîchir la liste
      loadData();
    } catch (err: any) {
      setFormError(err?.message || "Une erreur inattendue est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdSuccess) return;
    const text = `Identifiants Commercial M3ak :\nNom : ${createdSuccess.name}\nEmail : ${createdSuccess.email}\nMot de passe : ${createdSuccess.password}\nLien : ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtrage des prospecteurs
  const filteredProspectors = useMemo(() => {
    return prospectors.filter((p) => {
      const matchSearch =
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.wilaya?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchWilaya = selectedWilaya === "all" || p.wilaya === selectedWilaya;
      const matchStatus = selectedStatus === "all" || p.status === selectedStatus;
      return matchSearch && matchWilaya && matchStatus;
    });
  }, [prospectors, searchTerm, selectedWilaya, selectedStatus]);

  // Totaux statistiques
  const totalProspectors = prospectors.length;
  const activeCount = prospectors.filter((p) => p.status === "active").length;
  const totalAssigned = prospectors.reduce((acc, p) => acc + (p.assigned_count || 0), 0);
  const totalConversions = prospectors.reduce((acc, p) => acc + (p.conversions_count || 0), 0);
  const totalCommissions = prospectors.reduce((acc, p) => acc + (p.total_commission_da || 0), 0);

  // Données de performance pour les graphiques
  const chartData = useMemo(() => {
    return [...prospectors]
      .sort((a, b) => (b.conversions_count || 0) - (a.conversions_count || 0))
      .slice(0, 8)
      .map((p) => ({
        name: p.full_name.split(" ")[0] || p.email,
        prospects: p.assigned_count || 0,
        essais: p.active_trials_count || 0,
        ventes: p.conversions_count || 0,
      }));
  }, [prospectors]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Équipe Commerciale"
        description="Gérez les comptes de vos prospecteurs, suivez leur activité de terrain et analysez leurs performances de vente."
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Prospecteurs actifs"
          value={`${activeCount} / ${totalProspectors}`}
          icon={Users}
        />
        <StatCard
          label="Prospects affectés"
          value={totalAssigned.toLocaleString()}
          icon={MapPin}
        />
        <StatCard
          label="Ventes conclues"
          value={totalConversions.toLocaleString()}
          icon={TrendingUp}
        />
        <StatCard
          label="Taux moyen transfo."
          value={totalAssigned > 0 ? `${((totalConversions / totalAssigned) * 100).toFixed(1)}%` : "0%"}
          icon={Award}
        />
        <StatCard
          label="Commissions générées"
          value={`${totalCommissions.toLocaleString()} DA`}
          icon={ShieldCheck}
        />
      </div>

      {/* Tabs de navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all" className="gap-2">
            <Users className="size-4" />
            Tous ({prospectors.length})
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-2">
            <UserPlus className="size-4" />
            Ajouter
          </TabsTrigger>
          <TabsTrigger value="perf" className="gap-2">
            <TrendingUp className="size-4" />
            Performances
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: TOUS LES PROSPECTEURS */}
        <TabsContent value="all" className="space-y-4">
          {/* Barre de filtres */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-surface/70 p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Rechercher par nom, email, téléphone, wilaya..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedWilaya} onValueChange={setSelectedWilaya}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Toutes wilayas" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Toutes les wilayas</SelectItem>
                  {ALGERIA_WILAYAS.map((w) => (
                    <SelectItem key={w.code} value={w.name}>
                      {w.code} - {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-36">
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

          {/* Tableau des prospecteurs */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface/70 shadow-sm backdrop-blur-sm">
            <Table>
              <TableHeader className="bg-surface/90">
                <TableRow>
                  <TableHead>Prospecteur</TableHead>
                  <TableHead>Zone / Wilaya</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Prospects</TableHead>
                  <TableHead className="text-center">Essais</TableHead>
                  <TableHead className="text-center">Ventes</TableHead>
                  <TableHead className="text-right">Commissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center">
                      <div className="flex items-center justify-center gap-2 text-muted">
                        <RefreshCw className="size-4 animate-spin" />
                        Chargement de l'équipe...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredProspectors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-40 text-center text-muted">
                      Aucun prospecteur ne correspond à vos critères.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspectors.map((p) => {
                    const initials = p.full_name
                      ? p.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase()
                      : "P";

                    return (
                      <TableRow key={p.id} className="hover:bg-surface/90">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 border border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-foreground">{p.full_name}</div>
                              <div className="text-xs text-muted flex items-center gap-1">
                                <Mail className="size-3" />
                                {p.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <MapPin className="size-3.5 text-muted shrink-0" />
                            <span>{p.wilaya || "Non définie"}</span>
                            {p.commune && (
                              <span className="text-xs text-muted">({p.commune})</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm font-mono text-muted">
                            <Phone className="size-3.5" />
                            {p.phone || "—"}
                          </div>
                        </TableCell>

                        <TableCell>
                          {p.status === "active" ? (
                            <StatusBadge status="active" label="Actif" />
                          ) : (
                            <StatusBadge status="expired" label="Suspendu" />
                          )}
                        </TableCell>

                        <TableCell className="text-center font-semibold">
                          {p.assigned_count || 0}
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                            {p.active_trials_count || 0}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                            {p.conversions_count || 0}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-semibold text-foreground">
                          {(p.total_commission_da || 0).toLocaleString()} DA
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              title="Voir ses prospects attribués"
                            >
                              <Link
                                to="/admin/prospection/prospects"
                                search={{ tab: "all", prospectorId: p.id }}
                              >
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className={
                                p.status === "active"
                                  ? "text-rose-500 hover:text-rose-600"
                                  : "text-emerald-500 hover:text-emerald-600"
                              }
                              title={p.status === "active" ? "Suspendre l'accès" : "Réactiver"}
                              onClick={() => handleToggleStatus(p.id, p.status)}
                            >
                              {p.status === "active" ? (
                                <UserX className="size-4" />
                              ) : (
                                <UserCheck className="size-4" />
                              )}
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

        {/* TAB 2: AJOUTER UN PROSPECTEUR */}
        <TabsContent value="new" className="space-y-6">
          {createdSuccess && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-emerald-950 dark:text-emerald-100">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="size-6 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold text-lg">Prospecteur créé avec succès !</h4>
                  <p className="text-sm text-muted-foreground">
                    Le compte Supabase Auth a été généré avec le rôle commercial{" "}
                    <code className="font-mono bg-surface/50 px-1.5 py-0.5 rounded text-primary">
                      prospector
                    </code>
                    . Transmettez les identifiants ci-dessous au prospecteur.
                  </p>
                  <div className="mt-3 rounded-xl border border-emerald-500/30 bg-surface/80 p-4 font-mono text-sm space-y-1">
                    <div>
                      <span className="text-muted">Nom :</span> <strong>{createdSuccess.name}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Email :</span> <strong>{createdSuccess.email}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Mot de passe :</span>{" "}
                      <strong className="text-amber-500">{createdSuccess.password}</strong>
                    </div>
                  </div>
                  <Button
                    onClick={handleCopyCredentials}
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-2 bg-surface"
                  >
                    {copied ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                    {copied ? "Identifiants copiés !" : "Copier les accès"}
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
                  Ce formulaire crée un utilisateur sécurisé avec le rôle commercial dans Supabase Auth
                  et initialise sa fiche profil.
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
                      placeholder="Ex: Karim Benali"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email professionnel *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="karim.benali@m3ak.dz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Téléphone *</Label>
                    <Input
                      id="phone"
                      placeholder="0550 12 34 56"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="wilaya">Wilaya d'affectation *</Label>
                    <Select value={wilaya} onValueChange={setWilaya}>
                      <SelectTrigger id="wilaya">
                        <SelectValue placeholder="Choisir wilaya" />
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
                      placeholder="Ex: Bab Ezzouar"
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe temporaire *</Label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateSecurePassword())}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <KeyRound className="size-3" />
                      Régénérer
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
                  <p className="text-xs text-muted">
                    Le prospecteur pourra modifier son mot de passe lors de sa première connexion.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Informations complémentaires</Label>
                  <Textarea
                    id="notes"
                    placeholder="Objectifs mensuels, compétences, historique..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" disabled={submitting} className="gap-2">
                    {submitting ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <UserPlus className="size-4" />
                    )}
                    {submitting ? "Création en cours..." : "Créer le compte prospecteur"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: PERFORMANCES */}
        <TabsContent value="perf" className="space-y-6">
          {/* Graphique comparatif */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Comparatif des Prospecteurs</h3>
              <p className="text-sm text-muted">
                Nombre de prospects affectés, essais gratuits déclenchés et commerces convertis en abonnements payants.
              </p>
            </div>

            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted)" tickLine={false} />
                  <YAxis stroke="var(--color-muted)" tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="prospects" fill="#3b82f6" name="Prospects" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="essais" fill="#f59e0b" name="Essais 7j" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ventes" fill="#10b981" name="Conversions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Award className="size-5 text-amber-500" />
              Classement des Meilleurs Vendeurs
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...prospectors]
                .sort((a, b) => (b.conversions_count || 0) - (a.conversions_count || 0))
                .slice(0, 3)
                .map((top, idx) => (
                  <div
                    key={top.id}
                    className="relative overflow-hidden rounded-xl border border-border/70 bg-surface p-5 space-y-3"
                  >
                    <div className="absolute right-3 top-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 font-bold text-xs">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 border border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {top.full_name?.substring(0, 2).toUpperCase() || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-semibold text-foreground">{top.full_name}</div>
                        <div className="text-xs text-muted">{top.wilaya || "Algérie"}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                      <div>
                        <div className="text-muted">Ventes conclues</div>
                        <div className="font-bold text-emerald-600 text-sm">
                          {top.conversions_count || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted">Commissions</div>
                        <div className="font-bold text-foreground text-sm">
                          {(top.total_commission_da || 0).toLocaleString()} DA
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

