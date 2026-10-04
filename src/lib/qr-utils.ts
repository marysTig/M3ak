/**
 * qr-utils.ts
 *
 * Génération de vrais QR codes avec la bibliothèque `qrcode`.
 * Le contenu du QR = le token opaque uniquement (pas les données sensibles).
 */
import QRCode from "qrcode";

/**
 * Génère un QR code en base64 PNG à partir d'un token.
 * Le QR code ne contient QUE le token — jamais les points ni les données client.
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 300,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });
    return dataUrl;
  } catch (err) {
    console.error("Erreur génération QR:", err);
    throw new Error("Impossible de générer le QR code.");
  }
}

/**
 * Génère un QR code en SVG string.
 */
export async function generateQrSvg(token: string): Promise<string> {
  try {
    const svg = await QRCode.toString(token, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
    });
    return svg;
  } catch (err) {
    console.error("Erreur génération QR SVG:", err);
    throw new Error("Impossible de générer le QR code SVG.");
  }
}
