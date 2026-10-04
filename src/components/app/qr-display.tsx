/**
 * qr-display.tsx
 *
 * Affiche un vrai QR code généré par la bibliothèque qrcode.
 * Remplace le MockQr decoratif pour les vrais tokens de carte.
 */
import { useEffect, useState } from "react";

import { generateQrDataUrl } from "@/lib/qr-utils";
import { cn } from "@/lib/utils";

interface QrDisplayProps {
  token: string;
  size?: number;
  className?: string;
  /** Label affiché en fallback si le QR n'est pas encore généré */
  label?: string;
}

export function QrDisplay({ token, size = 280, className, label }: QrDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    setDataUrl(null);
    setError(false);
    generateQrDataUrl(token)
      .then(setDataUrl)
      .catch(() => setError(true));
  }, [token]);

  if (error || !token) {
    return (
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-2xl border border-border bg-surface p-4",
          className,
        )}
        style={{ width: size, maxWidth: "100%" }}
      >
        <div className="mock-qr size-full rounded-lg opacity-30" aria-hidden />
        <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border-4 border-surface bg-primary text-xs font-semibold text-primary-foreground">
          {label ?? "QR"}
        </span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={cn(
          "relative flex aspect-square items-center justify-center rounded-2xl border border-border bg-surface p-4",
          className,
        )}
        style={{ width: size, maxWidth: "100%" }}
      >
        <div className="size-full animate-pulse rounded-lg bg-surface-muted" />
        <p className="absolute text-xs text-muted-foreground">Génération...</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex aspect-square items-center justify-center rounded-2xl border border-border bg-white p-3",
        className,
      )}
      style={{ width: size, maxWidth: "100%" }}
    >
      <img
        src={dataUrl}
        alt="QR code de fidélité"
        className="size-full rounded-lg"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
