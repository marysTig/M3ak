/**
 * scan-points-dialog.tsx
 *
 * Dialog complet du workflow de scan :
 * 1. Scan du QR Code du client
 * 2. Identification + vérification du commerçant
 * 3. Affichage du solde
 * 4. Ajout de points
 * 5. Confirmation avec nouveau solde
 */
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { QrScanner } from "@/components/app/qr-scanner";
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
import {
  addPoints,
  getCardById,
  getCustomerById,
  MERCHANT_ID,
  MERCHANT_NAME,
  resolveQrToken,
  STORE_ID,
  validatePointsToAdd,
  formatDate,
  type LoyaltyCard,
  type LoyaltyCustomer,
  type LoyaltyTransaction,
} from "@/lib/loyalty-store";

interface ScanPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPointsAdded?: () => void;
}

type Step = "scan" | "identified" | "confirmed";

interface ScanResult {
  card: LoyaltyCard;
  customer: LoyaltyCustomer;
}

interface ConfirmResult {
  card: LoyaltyCard;
  transaction: LoyaltyTransaction;
  customer: LoyaltyCustomer;
  pointsAdded: number;
}

export function ScanPointsDialog({ open, onOpenChange, onPointsAdded }: ScanPointsDialogProps) {
  const [step, setStep] = useState<Step>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [pointsError, setPointsError] = useState("");
  const [addingPoints, setAddingPoints] = useState(false);
  const [description, setDescription] = useState("");

  function reset() {
    setStep("scan");
    setScanResult(null);
    setConfirmResult(null);
    setPointsInput("");
    setPointsError("");
    setAddingPoints(false);
    setDescription("");
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  function handleScan(token: string) {
    // Résolution du token → carte (vérification merchant intégrée)
    const card = resolveQrToken(token, MERCHANT_ID);

    if (!card) {
      toast.error("QR invalide ou carte introuvable.", {
        description: "Ce QR code ne correspond à aucune carte de ce commerce.",
      });
      return;
    }

    if (card.status !== "active") {
      toast.error(`Carte ${card.status}`, {
        description: "Cette carte n'est pas active. Opération refusée.",
      });
      return;
    }

    const customer = getCustomerById(card.customerId);
    if (!customer) {
      toast.error("Client introuvable.");
      return;
    }

    setScanResult({ card, customer });
    setStep("identified");
    toast.success(`Client identifié : ${customer.name}`);
  }

  function handleScanError(err: string) {
    toast.error(err);
  }

  function validateAndSetPoints(value: string) {
    setPointsInput(value);
    if (!value) {
      setPointsError("");
      return;
    }
    const v = validatePointsToAdd(Number(value));
    setPointsError(v.error ?? "");
  }

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!scanResult) return;

    const n = Number(pointsInput);
    const v = validatePointsToAdd(n);
    if (!v.valid) {
      setPointsError(v.error ?? "Valeur invalide.");
      return;
    }

    setAddingPoints(true);
    try {
      // Re-lire la carte fraîche avant ajout (anti-race)
      const freshCard = getCardById(scanResult.card.id);
      if (!freshCard) {
        toast.error("Carte introuvable.");
        return;
      }

      const result = addPoints(
        freshCard.id,
        n,
        MERCHANT_ID,
        STORE_ID,
        description.trim() || `Ajout de ${n} points — ${MERCHANT_NAME}`,
        MERCHANT_ID,
      );

      setConfirmResult({
        card: result.card,
        transaction: result.transaction,
        customer: scanResult.customer,
        pointsAdded: n,
      });
      setStep("confirmed");
      onPointsAdded?.();
      toast.success(`+${n} points ajoutés à ${scanResult.customer.name}`, {
        description: `Nouveau solde : ${result.card.points} points`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue.";
      toast.error(msg);
    } finally {
      setAddingPoints(false);
    }
  }

  function handleScanAnother() {
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* ── Étape 1 : Scan ── */}
        {step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle>Scanner le QR Code</DialogTitle>
              <DialogDescription>
                Pointez la caméra sur la carte virtuelle du client.
              </DialogDescription>
            </DialogHeader>
            <div className="pt-2">
              <QrScanner onScan={handleScan} onError={handleScanError} />
            </div>
          </>
        )}

        {/* ── Étape 2 : Client identifié + ajout points ── */}
        {step === "identified" && scanResult && (
          <>
            <DialogHeader>
              <DialogTitle>Client identifié</DialogTitle>
              <DialogDescription>
                Vérifiez les informations puis ajoutez les points.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Info client */}
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {scanResult.customer.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold">{scanResult.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{scanResult.customer.email}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-display text-xl font-bold text-primary">
                      {scanResult.card.points}
                    </p>
                    <p className="text-xs text-muted-foreground">points actuels</p>
                  </div>
                </div>
              </div>

              {/* Formulaire points */}
              <form onSubmit={handleAddPoints} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="points-to-add">Points à ajouter</Label>
                  <Input
                    id="points-to-add"
                    inputMode="numeric"
                    placeholder="ex: 20"
                    value={pointsInput}
                    onChange={(e) => validateAndSetPoints(e.target.value)}
                    disabled={addingPoints}
                  />
                  {pointsError && (
                    <p className="text-xs text-destructive">{pointsError}</p>
                  )}
                  {pointsInput && !pointsError && (
                    <p className="text-xs text-muted-foreground">
                      Nouveau solde :{" "}
                      <strong>{scanResult.card.points + Number(pointsInput)} points</strong>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points-desc">Description (optionnel)</Label>
                  <Input
                    id="points-desc"
                    placeholder="Achat €20, visite, etc."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={addingPoints}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("scan")}
                  >
                    <ScanLine className="size-4" />
                    Re-scanner
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={addingPoints || !pointsInput || !!pointsError}
                  >
                    {addingPoints ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Ajouter les points
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* ── Étape 3 : Confirmation ── */}
        {step === "confirmed" && confirmResult && (
          <>
            <DialogHeader>
              <DialogTitle>Points ajoutés !</DialogTitle>
              <DialogDescription>
                La transaction a été enregistrée avec succès.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Résumé */}
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-success-soft p-5 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-white text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <p className="font-display text-3xl font-bold text-success">
                    +{confirmResult.pointsAdded}
                  </p>
                  <p className="text-sm text-success/80">points ajoutés</p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-surface-muted p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{confirmResult.customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solde précédent</span>
                  <span className="font-medium">{confirmResult.transaction.previousBalance} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points ajoutés</span>
                  <span className="font-medium text-success">
                    +{confirmResult.transaction.pointsAdded}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold">Nouveau solde</span>
                  <span className="font-bold text-primary">
                    {confirmResult.transaction.newBalance} pts
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-muted-foreground">
                    {formatDate(confirmResult.transaction.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleScanAnother}>
                  <ScanLine className="size-4" />
                  Nouveau scan
                </Button>
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
