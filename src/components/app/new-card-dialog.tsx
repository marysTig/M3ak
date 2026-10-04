/**
 * new-card-dialog.tsx
 *
 * Dialog de création d'un nouveau client + carte de fidélité.
 * Connecté aux interfaces existantes de business.index.tsx.
 * NE modifie PAS le design — s'intègre dans les composants UI existants.
 */
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrDisplay } from "@/components/app/qr-display";
import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendLoyaltyCardEmail } from "@/lib/email-service";
import {
  createCard,
  createCustomer,
  getMerchantTheme,
  MERCHANT_ID,
  MERCHANT_NAME,
  STORE_ID,
  validateEmail,
  type LoyaltyCard,
  type LoyaltyCustomer,
} from "@/lib/loyalty-store";

interface NewCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "form" | "created";

interface CreatedData {
  customer: LoyaltyCustomer;
  card: LoyaltyCard;
  emailSent: boolean;
  emailSimulated: boolean;
}

export function NewCardDialog({ open, onOpenChange, onCreated }: NewCardDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [created, setCreated] = useState<CreatedData | null>(null);

  function reset() {
    setStep("form");
    setForm({ name: "", email: "" });
    setErrors({ name: "", email: "" });
    setCreated(null);
    setLoading(false);
    setResendLoading(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function validate() {
    const errs = { name: "", email: "" };
    if (!form.name.trim()) errs.name = "Le nom est requis.";
    if (!form.email.trim()) {
      errs.email = "L'adresse e-mail est requise.";
    } else if (!validateEmail(form.email)) {
      errs.email = "Adresse e-mail invalide.";
    }
    setErrors(errs);
    return !errs.name && !errs.email;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Créer le client (vérifie doublons)
      const customer = createCustomer(form.name.trim(), form.email.trim(), MERCHANT_ID);

      // 2. Créer la carte liée (avec thème du commerçant)
      const themeId = getMerchantTheme(MERCHANT_ID);
      const card = createCard(customer.id, MERCHANT_ID, STORE_ID, themeId);

      // 3. Envoyer l'email (ne bloque pas si erreur)
      let emailSent = false;
      let emailSimulated = false;
      try {
        const result = await sendLoyaltyCardEmail({
          customer,
          card,
          businessName: MERCHANT_NAME,
        });
        emailSent = result.success;
        emailSimulated = result.simulated ?? false;
      } catch {
        emailSent = false;
      }

      setCreated({ customer, card, emailSent, emailSimulated });
      setStep("created");
      onCreated?.();

      if (emailSimulated) {
        toast.success(`Carte créée pour ${customer.name}`, {
          description: "Email simulé (EmailJS non configuré).",
        });
      } else if (emailSent) {
        toast.success(`Carte créée et envoyée à ${customer.email}`);
      } else {
        toast.warning(`Carte créée pour ${customer.name}`, {
          description: "L'envoi d'email a échoué. Renvoyez depuis la page client.",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!created) return;
    setResendLoading(true);
    try {
      const result = await sendLoyaltyCardEmail({
        customer: created.customer,
        card: created.card,
        businessName: MERCHANT_NAME,
      });
      if (result.success) {
        if (result.simulated) {
          toast.info("Email simulé (EmailJS non configuré).");
        } else {
          toast.success(`Email renvoyé à ${created.customer.email}`);
        }
        setCreated({ ...created, emailSent: true });
      } else {
        toast.error("Échec du renvoi. Vérifiez la configuration EmailJS.");
      }
    } catch {
      toast.error("Erreur lors du renvoi de l'email.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>Créer une nouvelle carte</DialogTitle>
              <DialogDescription>
                Saisissez les informations du client pour créer sa carte de fidélité.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Nom du client</Label>
                <Input
                  id="customer-name"
                  placeholder="Ahmed Belkacem"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={loading}
                  autoComplete="off"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Adresse e-mail</Label>
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="ahmed@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                  autoComplete="off"
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => handleOpenChange(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Créer la carte
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === "created" && created && (
          <>
            <DialogHeader>
              <DialogTitle>Carte créée avec succès !</DialogTitle>
              <DialogDescription>
                La carte de fidélité de <strong>{created.customer.name}</strong> est prête.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Virtual Card */}
              <div className="flex flex-col items-center gap-4">
                <div className="w-full max-w-[360px]">
                  <VirtualCard
                    theme={themes.find(t => t.id === created.card.themeId) || themes[0]}
                    businessName={MERCHANT_NAME}
                    points={created.card.points}
                    customerName={created.customer.name}
                    qrToken={created.card.qrToken}
                    compact
                  />
                </div>
              </div>

              {/* Statut email */}
              <div
                className={`rounded-xl px-4 py-3 text-sm ${
                  created.emailSent
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning"
                }`}
              >
                <Mail className="mr-2 inline size-4" />
                {created.emailSimulated
                  ? "Email simulé (EmailJS non configuré)"
                  : created.emailSent
                    ? `Carte envoyée à ${created.customer.email}`
                    : "L'envoi d'email a échoué"}
              </div>

              <div className="flex gap-2">
                {!created.emailSent && !created.emailSimulated && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleResend}
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    Renvoyer
                  </Button>
                )}
                <Button className="flex-1" onClick={() => handleOpenChange(false)}>
                  Terminer
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
