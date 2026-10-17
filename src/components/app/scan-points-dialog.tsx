/**
 * scan-points-dialog.tsx — v2
 *
 * Dialog de scan QR → identification client → ajout de points.
 * Utilise supabase.rpc('add_points') pour l'atomicité.
 * Conserver le même design — seules les opérations changent.
 */
import { CheckCircle2, Loader2, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QrScanner } from "@/components/app/qr-scanner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { addPoints, resolveQrToken } from "@/lib/db/cards";

interface ScanPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPointsAdded?: () => void;
}

type Step = "scan" | "identified" | "confirmed";

interface ScanResult {
  card: {
    id: string;
    qr_token: string;
    points: number;
    status: string;
  };
  customerName: string;
  customerEmail: string;
}

interface ConfirmResult {
  card_id: string;
  previous_balance: number;
  points_added: number;
  new_balance: number;
  transaction_id: string;
  created_at: string;
  customer_name: string;
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

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleScan(token: string) {
    try {
      const result = await resolveQrToken(token);
      if (!result) {
        toast.error("QR invalide ou carte introuvable.", {
          description: "Ce QR code ne correspond à aucune carte de ce commerce.",
        });
        return;
      }

      if (result.card.status !== "active") {
        toast.error(`Carte ${result.card.status}`, {
          description: "Cette carte n'est pas active. Opération refusée.",
        });
        return;
      }

      setScanResult(result);
      setStep("identified");
      toast.success(`Client identifié : ${result.customerName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la lecture du QR.");
    }
  }

  function handleScanError(err: string) {
    toast.error(err);
  }

  function validateAndSetPoints(value: string) {
    setPointsInput(value);
    if (!value) { setPointsError(""); return; }
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0 || n > 10000) {
      setPointsError("Nombre de points invalide (1–10 000 entier).");
    } else {
      setPointsError("");
    }
  }

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!scanResult) return;

    const n = Number(pointsInput);
    if (!n || n <= 0 || n > 10000) {
      setPointsError("Nombre de points invalide (1–10 000).");
      return;
    }

    setAddingPoints(true);
    try {
      const result = await addPoints({
        qrToken: scanResult.card.qr_token,
        points: n,
        ...(description.trim() ? { description: description.trim() } : {}),
      });

      setConfirmResult({
        ...result,
        customer_name: scanResult.customerName,
      });
      setStep("confirmed");
      onPointsAdded?.();
      toast.success(`+${n} points ajoutés à ${scanResult.customerName}`, {
        description: `Nouveau solde : ${result.new_balance} points`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setAddingPoints(false);
    }
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
              <div className="rounded-xl bg-surface-muted p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    {scanResult.customerName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold">{scanResult.customerName}</p>
                    {scanResult.customerEmail && (
                      <p className="text-xs text-muted-foreground">{scanResult.customerEmail}</p>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="font-display text-xl font-bold text-primary">{scanResult.card.points}</p>
                    <p className="text-xs text-muted-foreground">points actuels</p>
                  </div>
                </div>
              </div>

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
                  {pointsError && <p className="text-xs text-destructive">{pointsError}</p>}
                  {pointsInput && !pointsError && (
                    <p className="text-xs text-muted-foreground">
                      Nouveau solde : <strong>{scanResult.card.points + Number(pointsInput)} points</strong>
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
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("scan")}>
                    <ScanLine className="size-4" /> Re-scanner
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={addingPoints || !pointsInput || !!pointsError}
                  >
                    {addingPoints ? <Loader2 className="size-4 animate-spin" /> : null}
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
              <DialogDescription>La transaction a été enregistrée avec succès.</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-success-soft p-5 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-white text-success">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <p className="font-display text-3xl font-bold text-success">+{confirmResult.points_added}</p>
                  <p className="text-sm text-success/80">points ajoutés</p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl bg-surface-muted p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{confirmResult.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solde précédent</span>
                  <span className="font-medium">{confirmResult.previous_balance} pts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Points ajoutés</span>
                  <span className="font-medium text-success">+{confirmResult.points_added}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-semibold">Nouveau solde</span>
                  <span className="font-bold text-primary">{confirmResult.new_balance} pts</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-muted-foreground">
                    {new Date(confirmResult.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { reset(); }}>
                  <ScanLine className="size-4" /> Nouveau scan
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
