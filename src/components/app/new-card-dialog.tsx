/**
 * new-card-dialog.tsx — v3
 *
 * Création d'un nouveau client par nom + numéro de téléphone (ou simple nom).
 * La carte est partagée via un LIEN UNIQUE (WhatsApp ou SMS).
 * Le client ouvre le lien et voit sa carte sans créer de compte.
 */
import { Copy, Loader2, MessageCircle, Phone, Share2, Smartphone, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { VirtualCard, themes } from "@/routes/business.program";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { getLoyaltyProgram } from "@/lib/db/program";

interface NewCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "form" | "created";

interface CreatedData {
  customerName: string;
  cardId: string;
  qrToken: string;
  points: number;
  themeId: string;
  cardLink: string;
  phone?: string;
}

/** Génère le lien public de la carte */
function buildCardLink(qrToken: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://m3ak.vercel.app";
  return `${base}/card/${qrToken}`;
}

/** Formate le numéro local saisi (commence directement par 07, 05 ou 06, sans +213 ni 213) */
function normalizeLocalPhone(value: string): string {
  let v = value.trim().replace(/\s+/g, "");
  // Si l'utilisateur colle avec +2130... ou 2130...
  if (v.startsWith("+2130")) {
    return "0" + v.slice(5);
  }
  if (v.startsWith("+213")) {
    return "0" + v.slice(4);
  }
  if (v.startsWith("2130")) {
    return "0" + v.slice(4);
  }
  if (v.startsWith("213") && v.length >= 11) {
    return "0" + v.slice(3);
  }
  return value;
}

/** Formate le numéro pour l'API WhatsApp (wa.me) : doit être 2137XXXXXXXX (SANS 0 entre 213 et 7) */
function formatWhatsAppPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Si l'utilisateur avait écrit 21307... -> corriger en 2137...
  if (digits.startsWith("2130")) {
    return "213" + digits.slice(4);
  }
  // Si le numéro commence par 0 (ex: 07XXXXXXXX) -> remplacer le 0 par 213
  if (digits.startsWith("0")) {
    return "213" + digits.slice(1);
  }
  // Si déjà 9 chiffres sans préfixe (ex: 7XXXXXXXX) -> ajouter 213
  if (!digits.startsWith("213") && digits.length === 9) {
    return "213" + digits;
  }
  return digits;
}

/** Formate le numéro pour l'application SMS : format direct 07XXXXXXXX */
function formatSMSPhone(raw: string): string {
  return normalizeLocalPhone(raw);
}

export function NewCardDialog({ open, onOpenChange, onCreated }: NewCardDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [errors, setErrors] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedData | null>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("Mon commerce");
  const [themeId, setThemeId] = useState("aurora");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: m } = await supabase.from("merchants").select("id, name").eq("owner_id", user.id).maybeSingle();
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
    setForm({ name: "", phone: "" });
    setErrors({ name: "", phone: "" });
    setCreated(null);
    setLoading(false);
    setCopied(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  function validate() {
    const errs = { name: "", phone: "" };
    if (!form.name.trim()) errs.name = "Le nom est requis.";
    setErrors(errs);
    return !errs.name;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !merchantId) return;
    setLoading(true);

    try {
      // Appeler la RPC sécurisée — crée le profil fantôme + la carte sans toucher à la session
      const { data, error } = await supabase.rpc("merchant_create_card", {
        p_customer_name: form.name.trim(),
        p_merchant_id: merchantId,
        p_phone: form.phone.trim() || null,
      });

      if (error) {
        // Message d'erreur clair si la RPC n'a pas encore été créée dans Supabase
        if (error.message?.includes("Could not find the function") || error.code === "PGRST202") {
          throw new Error(
            "La fonction SQL n'est pas encore créée dans Supabase. Exécutez le script supabase-update.sql dans votre Supabase SQL Editor.",
          );
        }
        throw new Error(error.message);
      }
      if (!data) throw new Error("Erreur lors de la création de la carte.");

      const card = data as { card_id: string; qr_token: string; points: number; customer_name: string };
      const cardLink = buildCardLink(card.qr_token);

      setCreated({
        customerName: form.name.trim(),
        cardId: card.card_id,
        qrToken: card.qr_token,
        points: card.points,
        themeId,
        cardLink,
        phone: form.phone.trim() || undefined,
      });
      setStep("created");
      onCreated?.();
      toast.success(`Carte créée pour ${form.name.trim()} !`, {
        description: "Partagez le lien par WhatsApp ou SMS.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.cardLink);
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  }

  function handleShareWhatsApp() {
    if (!created) return;
    const waPhone = formatWhatsAppPhone(form.phone);
    const msg = encodeURIComponent(
      `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* : ${created.cardLink}\n Ouvrez ce lien pour voir vos points et récompenses`
    );
    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleShareSMS() {
    if (!created) return;
    const smsPhone = formatSMSPhone(form.phone);
    const body = encodeURIComponent(
      `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* : ${created.cardLink}\n Ouvrez ce lien pour voir vos points et récompenses`
    );
    const url = smsPhone ? `sms:${smsPhone}?body=${body}` : `sms:?body=${body}`;
    window.open(url, "_self");
  }

  async function handleNativeShare() {
    if (!created || !navigator.share) return;
    try {
      await navigator.share({
        title: `Carte de fidélité ${merchantName}`,
        text: `Bonjour ${created.customerName} , Voici votre carte de fidélité *${merchantName}* :\n Ouvrez ce lien pour voir vos points et récompenses`,
        url: created.cardLink,
      });
    } catch {
      // L'utilisateur a annulé ou le navigateur ne supporte pas
    }
  }

  const selectedTheme = themes.find((t) => t.id === themeId) ?? themes[0]!;
  const hasNativeShare = typeof window !== "undefined" && !!navigator.share;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md max-h-[92dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        {step === "form" && (
          <>
            <DialogHeader className="text-center sm:text-left space-y-1">
              <DialogTitle className="text-base sm:text-lg font-bold">Créer une nouvelle carte</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Saisissez le nom du client. Un lien unique sera généré pour partager sa carte via WhatsApp ou SMS.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4 pt-1 sm:pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name" className="text-xs sm:text-sm">Nom du client</Label>
                <Input
                  id="customer-name"
                  placeholder="Ahmed Belkacem"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={loading}
                  autoComplete="off"
                  className="h-10 text-sm"
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone" className="text-xs sm:text-sm">
                  Numéro de téléphone{" "}
                  <span className="text-muted-foreground font-normal">(optionnel)</span>
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="customer-phone"
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: normalizeLocalPhone(e.target.value) })}
                    disabled={loading}
                    autoComplete="off"
                    className="pl-9 h-10 text-sm font-mono"
                  />
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground">
                  Format direct : 07XXXXXXXX, 05XXXXXXXX, 06XXXXXXXX
                </p>
              </div>
              <div className="flex gap-2 pt-1 sm:pt-2">
                <Button type="button" variant="outline" className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm" onClick={() => handleOpenChange(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="flex-1 h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-semibold" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4 mr-1.5" />
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
            <DialogHeader className="text-center sm:text-left space-y-1">
              <DialogTitle className="text-base sm:text-lg font-bold">
                Carte créée ! Partagez le lien
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                La carte de <strong className="text-foreground">{created.customerName}</strong> est prête. Envoyez le lien via WhatsApp ou SMS.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
              {/* Aperçu carte responsive */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[300px] sm:max-w-[340px]">
                  <VirtualCard
                    theme={selectedTheme}
                    businessName={merchantName}
                    points={created.points}
                    customerName={created.customerName}
                    compact
                  />
                </div>
              </div>

              {/* Bloc lien unique */}
              <div className="rounded-xl border bg-surface-muted p-2.5 sm:p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Lien unique de la carte</span>
                  {created.phone ? (
                    <span className="font-mono text-foreground font-semibold text-[11px]">
                      {created.phone}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <code className="flex-1 truncate rounded-lg bg-background px-2.5 py-1.5 text-xs font-mono select-all">
                    {created.cardLink}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0 h-8 px-2.5 text-xs rounded-lg"
                  >
                    {copied ? <Check className="size-3.5 mr-1 text-success" /> : <Copy className="size-3.5 mr-1" />}
                    {copied ? "Copié !" : "Copier"}
                  </Button>
                </div>
              </div>

              {/* Boutons de partage rapides */}
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <Button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="h-11 rounded-xl bg-[#25D366] hover:bg-[#1ebe59] text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition-all"
                >
                  <MessageCircle className="size-4 mr-1.5 shrink-0" />
                  WhatsApp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShareSMS}
                  className="h-11 rounded-xl font-semibold text-xs sm:text-sm active:scale-95 transition-all"
                >
                  <Smartphone className="size-4 mr-1.5 shrink-0" />
                  SMS
                </Button>
              </div>

              {hasNativeShare && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-xl text-xs sm:text-sm active:scale-95 transition-all"
                  onClick={handleNativeShare}
                >
                  <Share2 className="size-4 mr-1.5 shrink-0" />
                  Partager via l'appareil
                </Button>
              )}

              <Button
                className="w-full h-11 rounded-xl text-xs sm:text-sm font-semibold active:scale-95 transition-all"
                onClick={() => handleOpenChange(false)}
              >
                Terminer
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
