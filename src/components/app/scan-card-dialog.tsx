/**
 * scan-card-dialog.tsx
 *
 * Scanner de QR Code ultra-moderne et ergonomique pour smartphone et desktop.
 * - Utilise la caméra arrière (facingMode: environment)
 * - Rendu visuel soigné avec viseur cible et ligne laser animée
 * - Vérifie l'appartenance de la carte au commerce connecté
 * - Déclenche immédiatement l'affichage de la fiche client
 * - Mode secours : saisie/recherche manuelle (téléphone, nom ou token)
 */
import { Html5Qrcode } from "html5-qrcode";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  Keyboard,
  Loader2,
  ScanLine,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import type { CustomerWithCard } from "@/lib/db/customers";
import { cn } from "@/lib/utils";

interface ScanCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string | null;
  customers: CustomerWithCard[];
  onCustomerFound: (customer: CustomerWithCard) => void;
}

const READER_ELEMENT_ID = "m3ak-qr-reader-viewport";

export function extractToken(scannedText: string): string {
  const trimmed = scannedText.trim();
  // Extrait /card/<token> si URL complète ou chemin
  const match = trimmed.match(/\/card\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

function mapRowToCustomer(row: any): CustomerWithCard {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    customer: {
      id: profile?.id ?? row.customer_id ?? "",
      full_name: profile?.full_name ?? "Client",
      phone: profile?.phone ?? "",
      email: "",
    },
    card: {
      id: row.id,
      qr_token: row.qr_token,
      points: row.points ?? 0,
      total_earned: row.total_earned ?? 0,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      card_type: row.card_type || "points",
      card_name: row.card_name,
      theme_id: row.theme_id || "aurora",
      stamps_count: row.stamps_count ?? 0,
      stamps_target: row.stamps_target ?? 10,
      stamp_reward: row.stamp_reward ?? "1 produit offert au 10ème passage",
      stamp_conditions: row.stamp_conditions,
      vip_tier: row.vip_tier || "bronze",
      vip_spent: Number(row.vip_spent ?? 0),
      vip_bronze_threshold: Number(row.vip_bronze_threshold ?? 0),
      vip_silver_threshold: Number(row.vip_silver_threshold ?? 15000),
      vip_gold_threshold: Number(row.vip_gold_threshold ?? 30000),
      vip_bronze_benefits: row.vip_bronze_benefits ?? "-5% de réduction",
      vip_silver_benefits: row.vip_silver_benefits ?? "-10% de réduction + Cadeau",
      vip_gold_benefits: row.vip_gold_benefits ?? "-15% de réduction + Accès prioritaire",
    },
    status: "active",
    joinedFormatted: new Date(row.created_at).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };
}

export function ScanCardDialog({
  open,
  onOpenChange,
  merchantId,
  customers,
  onCustomerFound,
}: ScanCardDialogProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCustomer, setSuccessCustomer] = useState<CustomerWithCard | null>(null);
  const [manualInput, setManualInput] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // Réinitialisation lors de l'ouverture
  useEffect(() => {
    if (open) {
      setMode("camera");
      setCameraError(null);
      setErrorMessage(null);
      setSuccessCustomer(null);
      setIsVerifying(false);
      setManualInput("");
      isProcessingRef.current = false;
    } else {
      stopScanner();
    }
  }, [open]);

  // Initialisation et gestion du cycle de vie de la caméra
  useEffect(() => {
    if (!open || mode !== "camera") {
      stopScanner();
      return;
    }

    let isMounted = true;
    let scannerInstance: Html5Qrcode | null = null;

    const timer = setTimeout(async () => {
      const el = document.getElementById(READER_ELEMENT_ID);
      if (!el || !isMounted) return;

      try {
        scannerInstance = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = scannerInstance;

        await scannerInstance.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 230, height: 230 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (!isProcessingRef.current && isMounted) {
              handleScanSuccess(decodedText);
            }
          },
          () => {
            // Frame ignorée lors de la recherche
          }
        );

        if (isMounted) {
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setCameraActive(false);
        const msg = String(err?.message || err || "");
        if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
          setCameraError("Accès caméra refusé. Autorisez l'accès dans votre navigateur ou utilisez la recherche manuelle.");
        } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
          setCameraError("Aucune caméra détectée sur cet appareil.");
        } else {
          setCameraError("Impossible d'activer la caméra. Utilisez la saisie manuelle ci-dessous.");
        }
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopScanner();
    };
  }, [open, mode]);

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Ignorer les erreurs d'arrêt
      } finally {
        scannerRef.current = null;
        setCameraActive(false);
      }
    }
  }

  // Traitement d'un scan ou d'une saisie manuelle
  async function handleScanSuccess(rawDecoded: string) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsVerifying(true);
    setErrorMessage(null);

    // Pause de la caméra pendant la vérification
    if (scannerRef.current?.isScanning) {
      try {
        scannerRef.current.pause(true);
      } catch {}
    }

    const token = extractToken(rawDecoded);

    try {
      // 1. Chercher d'abord dans les clients déjà chargés en local
      const localMatch = customers.find((c) => {
        const cardToken = (c.card?.qr_token || "").toLowerCase();
        return cardToken && cardToken === token.toLowerCase();
      });

      if (localMatch) {
        onVerifySuccess(localMatch);
        return;
      }

      // 2. Si non trouvé en local, interroger Supabase
      const { data: cardRow, error } = await supabase
        .from("loyalty_cards")
        .select(`
          *,
          profiles!loyalty_cards_customer_id_fkey (id, full_name, phone)
        `)
        .eq("qr_token", token)
        .maybeSingle();

      if (error) throw error;

      if (!cardRow) {
        setErrorMessage("QR Code non reconnu ou carte introuvable.");
        resumeScanningAfterDelay();
        return;
      }

      // 3. Vérification de sécurité : la carte appartient-elle au commerce connecté ?
      if (merchantId && cardRow.merchant_id !== merchantId) {
        setErrorMessage("Attention : Cette carte appartient à un autre commerce !");
        resumeScanningAfterDelay();
        return;
      }

      // Carte valide !
      const matched = mapRowToCustomer(cardRow);
      onVerifySuccess(matched);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erreur de validation de la carte.");
      resumeScanningAfterDelay();
    } finally {
      setIsVerifying(false);
    }
  }

  function resumeScanningAfterDelay() {
    setTimeout(() => {
      isProcessingRef.current = false;
      setErrorMessage(null);
      if (scannerRef.current && mode === "camera") {
        try {
          scannerRef.current.resume();
        } catch {}
      }
    }, 2800);
  }

  function onVerifySuccess(customer: CustomerWithCard) {
    setSuccessCustomer(customer);
    // Retour haptique sur smartphone
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch {}
    }

    toast.success(`Client reconnu : ${customer.customer.full_name}`, {
      description: `Carte ${customer.card.card_type === "vip" ? "VIP" : customer.card.card_type === "stamps" ? "Tampons" : "Points"} prête pour enregistrement.`,
    });

    setTimeout(() => {
      onCustomerFound(customer);
      onOpenChange(false);
    }, 500);
  }

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = manualInput.trim();
    if (!query) return;

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const qNorm = query.toLowerCase();
      const qDigits = query.replace(/\D/g, "");
      const token = extractToken(query);

      // Recherche locale
      const localMatch = customers.find((c) => {
        const cToken = (c.card?.qr_token || "").toLowerCase();
        const cName = (c.customer?.full_name || "").toLowerCase();
        const cPhone = (c.customer?.phone || "").replace(/\D/g, "");

        if (cToken && cToken === token.toLowerCase()) return true;
        if (qDigits.length >= 8 && cPhone.includes(qDigits)) return true;
        if (qNorm.length >= 3 && cName.includes(qNorm)) return true;
        return false;
      });

      if (localMatch) {
        onVerifySuccess(localMatch);
        return;
      }

      // Recherche en base de données par token
      const { data: cardRow } = await supabase
        .from("loyalty_cards")
        .select(`
          *,
          profiles!loyalty_cards_customer_id_fkey (id, full_name, phone)
        `)
        .eq("qr_token", token)
        .maybeSingle();

      if (cardRow) {
        if (merchantId && cardRow.merchant_id !== merchantId) {
          setErrorMessage("Attention : Cette carte appartient à un autre commerce !");
          return;
        }
        onVerifySuccess(mapRowToCustomer(cardRow));
        return;
      }

      // Recherche en base de données par téléphone
      if (qDigits.length >= 8) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("phone", `%${qDigits}%`)
          .maybeSingle();

        if (profile && merchantId) {
          const { data: userCard } = await supabase
            .from("loyalty_cards")
            .select(`
              *,
              profiles!loyalty_cards_customer_id_fkey (id, full_name, phone)
            `)
            .eq("customer_id", profile.id)
            .eq("merchant_id", merchantId)
            .maybeSingle();

          if (userCard) {
            onVerifySuccess(mapRowToCustomer(userCard));
            return;
          }
        }
      }

      setErrorMessage("Aucun client ni carte trouvé avec ces informations.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Erreur lors de la recherche.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="space-y-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ScanLine className="size-4" />
            </span>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Scanner un QR Code
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Présentez la carte fidélité du client devant l'objectif pour afficher directement sa fiche.
          </DialogDescription>
        </DialogHeader>

        {/* Onglets rapides : Caméra vs Recherche manuelle */}
        <div className="flex rounded-xl bg-surface-muted p-1 text-xs font-semibold mt-1">
          <button
            type="button"
            onClick={() => setMode("camera")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all",
              mode === "camera"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Camera className="size-3.5" />
            Caméra en direct
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all",
              mode === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Keyboard className="size-3.5" />
            Saisie manuelle
          </button>
        </div>

        {/* VUE 1 : Caméra */}
        {mode === "camera" && (
          <div className="relative mt-2 flex flex-col items-center">
            {/* Zone caméra avec viewport stylisé */}
            <div className="relative aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl bg-black border border-border/60 shadow-inner flex items-center justify-center">
              <div id={READER_ELEMENT_ID} className="size-full overflow-hidden" />

              {/* Viseur HUD overlay */}
              {cameraActive && !cameraError && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative size-56 sm:size-60 rounded-2xl border border-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    {/* 4 coins lumineux */}
                    <div className="absolute -top-1 -left-1 size-5 border-t-2 border-l-2 border-primary rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 size-5 border-t-2 border-r-2 border-primary rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 size-5 border-b-2 border-l-2 border-primary rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 size-5 border-b-2 border-r-2 border-primary rounded-br-lg" />

                    {/* Ligne laser animée */}
                    {!isVerifying && !successCustomer && (
                      <div className="absolute inset-x-2 top-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_#3b82f6] animate-pulse" />
                    )}
                  </div>
                </div>
              )}

              {/* État chargement caméra */}
              {!cameraActive && !cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 text-center p-4 space-y-2">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground font-medium">Activation de la caméra...</p>
                </div>
              )}

              {/* État erreur caméra */}
              {cameraError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-muted text-center p-5 space-y-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <CameraOff className="size-5" />
                  </span>
                  <p className="text-xs text-destructive font-medium leading-relaxed max-w-[260px]">
                    {cameraError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-xl"
                    onClick={() => setMode("manual")}
                  >
                    <Keyboard className="size-3.5 mr-1.5" /> Passer à la saisie manuelle
                  </Button>
                </div>
              )}

              {/* Overlay de succès immédiat */}
              {successCustomer && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/85 text-center p-4 space-y-2 backdrop-blur-sm transition-all animate-in fade-in">
                  <CheckCircle2 className="size-12 text-emerald-400 animate-bounce" />
                  <p className="text-sm font-bold text-white">Carte reconnue !</p>
                  <p className="text-xs text-emerald-200">{successCustomer.customer.full_name}</p>
                </div>
              )}

              {/* Overlay de vérification en cours */}
              {isVerifying && !successCustomer && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/75 text-center p-4 space-y-2 backdrop-blur-xs">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-xs font-semibold text-white">Vérification de la carte...</p>
                </div>
              )}
            </div>

            {/* Message d'erreur scan (ex: autre commerce ou invalide) */}
            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive font-medium animate-in fade-in">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Alignez le QR code situé au centre de la carte client à l'intérieur du cadre.
            </p>
          </div>
        )}

        {/* VUE 2 : Saisie manuelle */}
        {mode === "manual" && (
          <form onSubmit={handleManualSearch} className="mt-2 space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="manual-search-input" className="text-xs font-semibold text-foreground">
                Recherche par téléphone, nom ou token QR
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="manual-search-input"
                  placeholder="Ex: 07XXXXXXXX, Ahmed Belkacem, ou token"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="pl-9 h-10 text-xs sm:text-sm"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Saisissez le numéro de mobile du client, son nom complet ou le lien de sa carte.
              </p>
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive font-medium animate-in fade-in">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs h-10 rounded-xl"
                onClick={() => setMode("camera")}
              >
                <Camera className="size-3.5 mr-1.5" /> Revenir à la caméra
              </Button>
              <Button
                type="submit"
                className="flex-1 text-xs h-10 rounded-xl font-semibold bg-primary"
                disabled={!manualInput.trim() || isVerifying}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" /> Recherche...
                  </>
                ) : (
                  <>
                    <Search className="size-3.5 mr-1.5" /> Rechercher
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

