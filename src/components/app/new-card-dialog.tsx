/**
 * new-card-dialog.tsx — v2
 *
 * Création d'un nouveau client par invitation email.
 * Utilise Supabase Auth (signUp) + création de carte en base.
 * Ne modifie PAS le design.
 */
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QrDisplay } from "@/components/app/qr-display";
import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { getLoyaltyProgram } from "@/lib/db/program";
import { sendLoyaltyCardEmail } from "@/lib/email-service";

interface NewCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "form" | "created";

interface CreatedData {
  customerName: string;
  customerEmail: string;
  cardId: string;
  qrToken: string;
  points: number;
  themeId: string;
  emailSent: boolean;
  emailSimulated: boolean;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function NewCardDialog({ open, onOpenChange, onCreated }: NewCardDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", email: "" });
  const [errors, setErrors] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [created, setCreated] = useState<CreatedData | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("Mon commerce");
  const [themeId, setThemeId] = useState("aurora");

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id, name").eq("owner_id", user.id).single();
      if (m) {
        setMerchantId(m.id);
        setMerchantName(m.name);
        const prog = await getLoyaltyProgram(m.id);
        if (prog?.theme_id) setThemeId(prog.theme_id);
      }
    });
  }, [open]);

  function reset() {
    setStep("form");
    setForm({ name: "", email: "" });
    setErrors({ name: "", email: "" });
    setCreated(null);
    setLoading(false);
    setResendLoading(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
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
    if (!validate() || !merchantId) return;
    setLoading(true);

    try {
      // 1. Créer le compte client via signUp (mot de passe temporaire)
      const tempPassword = Math.random().toString(36).slice(2, 10) + "A1!";
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: tempPassword,
        options: {
          data: { full_name: form.name.trim(), role: "customer" },
        },
      });

      if (authError) {
        // Si l'utilisateur existe déjà, on cherche son profil
        if (!authError.message.includes("already registered")) {
          throw new Error(authError.message);
        }
      }

      // Attendre que le trigger crée le profil
      await new Promise((r) => setTimeout(r, 800));

      const userId = authData?.user?.id;
      if (!userId) throw new Error("Impossible de récupérer l'ID utilisateur.");

      // 2. Créer la carte de fidélité
      const { data: existingCard } = await supabase
        .from("loyalty_cards")
        .select("id, qr_token, points")
        .eq("customer_id", userId)
        .eq("merchant_id", merchantId)
        .single();

      let card = existingCard;

      if (!card) {
        const { data: newCard, error: cardError } = await supabase
          .from("loyalty_cards")
          .insert({ customer_id: userId, merchant_id: merchantId })
          .select("id, qr_token, points")
          .single();
        if (cardError) throw new Error(cardError.message);
        card = newCard;
      }

      if (!card) throw new Error("Erreur lors de la création de la carte.");

      // 3. Envoyer l'email
      let emailSent = false;
      let emailSimulated = false;
      try {
        const result = await sendLoyaltyCardEmail({
          customer: { id: userId, name: form.name.trim(), email: form.email.trim() } as any,
          card: { id: card.id, qrToken: card.qr_token, points: card.points } as any,
          businessName: merchantName,
        });
        emailSent = result.success;
        emailSimulated = result.simulated ?? false;
      } catch {
        emailSent = false;
      }

      setCreated({
        customerName: form.name.trim(),
        customerEmail: form.email.trim(),
        cardId: card.id,
        qrToken: card.qr_token,
        points: card.points,
        themeId,
        emailSent,
        emailSimulated,
      });
      setStep("created");
      onCreated?.();

      if (emailSimulated) {
        toast.success(`Carte créée pour ${form.name}`, { description: "Email simulé." });
      } else if (emailSent) {
        toast.success(`Carte créée et envoyée à ${form.email}`);
      } else {
        toast.warning(`Carte créée pour ${form.name}`, {
          description: "L'envoi d'email a échoué.",
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!created) return;
    setResendLoading(true);
    try {
      const result = await sendLoyaltyCardEmail({
        customer: { id: "", name: created.customerName, email: created.customerEmail } as any,
        card: { id: created.cardId, qrToken: created.qrToken, points: created.points } as any,
        businessName: merchantName,
      });
      if (result.success) {
        if (result.simulated) {
          toast.info("Email simulé (EmailJS non configuré).");
        } else {
          toast.success(`Email renvoyé à ${created.customerEmail}`);
        }
        setCreated({ ...created, emailSent: true });
      } else {
        toast.error("Échec du renvoi.");
      }
    } catch {
      toast.error("Erreur lors du renvoi de l'email.");
    } finally {
      setResendLoading(false);
    }
  }

  const selectedTheme = themes.find((t) => t.id === themeId) ?? themes[0]!;

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
                La carte de fidélité de <strong>{created.customerName}</strong> est prête.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div className="flex flex-col items-center gap-4">
                <div className="flex w-full max-w-[360px] items-center justify-between px-1">
                  <span className="font-semibold">{created.customerName}</span>
                  <span className="text-sm font-medium text-muted-foreground">{merchantName}</span>
                </div>
                <div className="w-full max-w-[360px]">
                  <VirtualCard
                    theme={selectedTheme}
                    businessName={merchantName}
                    points={created.points}
                    compact
                  />
                </div>
                <div className="mt-2 flex flex-col items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground">QR Code de fidélité</p>
                  <QrDisplay token={created.qrToken} size={150} />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {created.qrToken.slice(0, 16)}...
                  </p>
                </div>
              </div>

              <div className={`rounded-xl px-4 py-3 text-sm ${
                created.emailSent ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
              }`}>
                <Mail className="mr-2 inline size-4" />
                {created.emailSimulated
                  ? "Email simulé (EmailJS non configuré)"
                  : created.emailSent
                    ? `Carte envoyée à ${created.customerEmail}`
                    : "L'envoi d'email a échoué"}
              </div>

              <div className="flex gap-2">
                {!created.emailSent && !created.emailSimulated && (
                  <Button variant="outline" className="flex-1" onClick={handleResend} disabled={resendLoading}>
                    {resendLoading ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
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
