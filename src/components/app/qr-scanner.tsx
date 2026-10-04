/**
 * qr-scanner.tsx
 *
 * Composant de scan QR réel utilisant html5-qrcode.
 * Déclenche onScan(token) quand un QR valide est détecté.
 * Affiche une interface de secours (saisie manuelle) si la caméra est refusée.
 */
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QrScannerProps {
  onScan: (token: string) => void;
  onError?: (err: string) => void;
}

const SCANNER_ID = "m3ak-qr-scanner-region";

export function QrScanner({ onScan, onError }: QrScannerProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [cameraError, setCameraError] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;

    hasScanned.current = false;

    const scanner = new Html5QrcodeScanner(
      SCANNER_ID,
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        showTorchButtonIfSupported: true,
        showZoomSliderIfSupported: true,
        defaultZoomValueIfSupported: 1,
      },
      false,
    );

    scanner.render(
      (decodedText) => {
        if (hasScanned.current) return;
        hasScanned.current = true;
        onScan(decodedText.trim());
        scanner.clear().catch(() => undefined);
      },
      (errorMessage) => {
        // Ignorer les erreurs de scan continue (aucun QR détecté)
        if (errorMessage?.includes("No MultiFormat Readers")) return;
        if (errorMessage?.includes("NotFoundException")) return;
        // Erreur caméra réelle
        if (errorMessage?.includes("NotAllowedError") || errorMessage?.includes("Permission")) {
          setCameraError(true);
          onError?.("Accès caméra refusé. Utilisez la saisie manuelle.");
        }
      },
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [mode, onScan, onError]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) return;
    onScan(token);
  }

  if (mode === "manual" || cameraError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-muted p-5 text-center">
          <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Keyboard className="size-5" />
          </span>
          <p className="text-sm font-medium">Saisie manuelle du token QR</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Saisissez le token figurant sous le QR code du client.
          </p>
        </div>
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="manual-token">Token QR</Label>
            <Input
              id="manual-token"
              placeholder="ex: a3f8b2c1d4e5..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!manualToken.trim()}>
            Valider le token
          </Button>
        </form>
        {!cameraError && (
          <Button variant="ghost" className="w-full" onClick={() => setMode("camera")}>
            <Camera className="size-4" />
            Utiliser la caméra
          </Button>
        )}
        {cameraError && (
          <p className="text-center text-xs text-muted-foreground">
            <CameraOff className="mr-1 inline size-3" />
            Caméra non disponible — veuillez saisir le token manuellement.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        id={SCANNER_ID}
        className="overflow-hidden rounded-xl border border-border"
        style={{ minHeight: 300 }}
      />
      <Button variant="ghost" className="w-full" onClick={() => setMode("manual")}>
        <Keyboard className="size-4" />
        Saisir le token manuellement
      </Button>
    </div>
  );
}
