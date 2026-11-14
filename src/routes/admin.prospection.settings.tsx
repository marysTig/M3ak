import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  HelpCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getProspectionSettings,
  updateProspectionSettings,
} from "@/lib/db/prospection-settings";
import type { ProspectionSettings } from "@/lib/types/prospection";

export const Route = createFileRoute("/admin/prospection/settings")({
  validateSearch: (search: Record<string, unknown>) => search,
  head: () => ({
    meta: [
      { title: "Paramètres de Prospection — M3ak CRM" },
      { name: "description", content: "Configuration des règles d'essai gratuit, montant des commissions et attribution." },
    ],
  }),
  component: ProspectionSettingsPage,
});

function ProspectionSettingsPage() {
  const [trialDays, setTrialDays] = useState(7);
  const [commissionAmount, setCommissionAmount] = useState(1500);
  const [alertDaysBefore, setAlertDaysBefore] = useState(2);
  const [requirePaymentForCommission, setRequirePaymentForCommission] = useState(true);
  const [autoDeactivateOnExpiry, setAutoDeactivateOnExpiry] = useState(true);
  const [autoAssignByWilaya, setAutoAssignByWilaya] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const s = await getProspectionSettings();
        setTrialDays(s.trial_days || 7);
        setCommissionAmount(s.commission_amount_da || 1500);
        setAlertDaysBefore(s.alert_days_before || 2);
        setRequirePaymentForCommission(s.require_payment_for_commission ?? true);
        setAutoDeactivateOnExpiry(s.auto_deactivate_on_expiry ?? true);
        setAutoAssignByWilaya(s.auto_assign_by_wilaya ?? true);
      } catch (err) {
        console.error("Erreur chargement paramètres :", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const ok = await updateProspectionSettings({
        trial_days: Number(trialDays),
        commission_amount_da: Number(commissionAmount),
        alert_days_before: Number(alertDaysBefore),
        require_payment_for_commission: requirePaymentForCommission,
        auto_deactivate_on_expiry: autoDeactivateOnExpiry,
        auto_assign_by_wilaya: autoAssignByWilaya,
      });

      if (ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Impossible de mettre à jour les paramètres.");
      }
    } catch (err: any) {
      setError(err?.message || "Une erreur est survenue lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Paramètres du Module Prospection"
        description="Ajustez les règles métier de l'essai gratuit, les seuils de commission commerciale et les automatisations."
      />

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-5 shrink-0" />
          Les paramètres de prospection ont été enregistrés avec succès.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600">
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: ESSAIS GRATUITS */}
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-purple-500" />
            <h3 className="font-semibold text-lg">Période d'Essai Gratuit</h3>
          </div>
          <p className="text-sm text-muted">
            Configurez la durée accordée aux nouveaux commerçants avant la souscription payante.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="trial">Durée de l'essai gratuit (jours)</Label>
              <Input
                id="trial"
                type="number"
                min={1}
                max={60}
                value={trialDays}
                onChange={(e) => setTrialDays(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted">
                Standard : 7 jours à compter de la création du compte commerçant.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alert">Alerte avant expiration (jours)</Label>
              <Input
                id="alert"
                type="number"
                min={1}
                max={10}
                value={alertDaysBefore}
                onChange={(e) => setAlertDaysBefore(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted">
                Délai pour notifier l'admin et le prospecteur (Standard : 2 jours).
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="deactivate" className="font-medium">
                  Désactiver automatiquement le compte commerçant à l'échéance
                </Label>
                <p className="text-xs text-muted">
                  Bloque l'accès aux scans et au dashboard si le commerçant n'a pas validé un abonnement payant.
                </p>
              </div>
              <Switch
                id="deactivate"
                checked={autoDeactivateOnExpiry}
                onCheckedChange={setAutoDeactivateOnExpiry}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: COMMISSIONS COMMERCIALES */}
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-5 text-emerald-500" />
            <h3 className="font-semibold text-lg">Commissions des Prospecteurs</h3>
          </div>
          <p className="text-sm text-muted">
            Rémunération forfaitaire versée aux commerciaux pour chaque commerce converti.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="comm">Montant de la commission par conversion (DA)</Label>
              <Input
                id="comm"
                type="number"
                min={500}
                max={10000}
                step={100}
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted">Standard M3ak : 1 500 DA par commerçant.</p>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="reqPay" className="font-medium">
                  Exiger la confirmation du paiement avant génération de la commission
                </Label>
                <p className="text-xs text-muted">
                  Empêche la validation des commissions tant que le commerçant n'a pas réglé son abonnement après les 7 jours d'essai.
                </p>
              </div>
              <Switch
                id="reqPay"
                checked={requirePaymentForCommission}
                onCheckedChange={setRequirePaymentForCommission}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: ATTRIBUTION & RÈGLES */}
        <div className="rounded-2xl border border-border/80 bg-surface/70 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" />
            <h3 className="font-semibold text-lg">Attribution & Distribution</h3>
          </div>
          <p className="text-sm text-muted">
            Règles de dispatching automatique des leads importés ou créés.
          </p>

          <div className="pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoAssign" className="font-medium">
                  Attribution automatique par Wilaya de résidence
                </Label>
                <p className="text-xs text-muted">
                  Affecte automatiquement un nouveau commerce au prospecteur actif présent dans la même wilaya.
                </p>
              </div>
              <Switch
                id="autoAssign"
                checked={autoAssignByWilaya}
                onCheckedChange={setAutoAssignByWilaya}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Enregistrement..." : "Sauvegarder les paramètres"}
          </Button>
        </div>
      </form>
    </div>
  );
}

