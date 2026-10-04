/**
 * email-service.ts
 *
 * Service d'envoi d'emails via EmailJS (client-side).
 * Variables d'environnement requises dans .env:
 *   VITE_EMAILJS_SERVICE_ID
 *   VITE_EMAILJS_TEMPLATE_ID
 *   VITE_EMAILJS_PUBLIC_KEY
 *
 * Si les variables ne sont pas configurées, le service log un avertissement
 * et retourne un succès simulé pour ne pas bloquer la création de carte.
 */

import emailjs from "@emailjs/browser";
import type { LoyaltyCard, LoyaltyCustomer } from "./loyalty-store";
import { MERCHANT_NAME } from "./loyalty-store";
import { generateQrDataUrl } from "./qr-utils";

export interface EmailCardPayload {
  customer: LoyaltyCustomer;
  card: LoyaltyCard;
  businessName?: string;
}

function isEmailConfigured(): boolean {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  return !!(serviceId && templateId && publicKey);
}

/**
 * Envoie la carte virtuelle au client par email.
 * Si EmailJS n'est pas configuré, log un avertissement et simule le succès.
 * La carte EST créée même si l'email échoue.
 */
export async function sendLoyaltyCardEmail(payload: EmailCardPayload): Promise<{ success: boolean; simulated?: boolean }> {
  const { customer, card, businessName = MERCHANT_NAME } = payload;

  if (!isEmailConfigured()) {
    console.warn(
      "[M3ak EmailService] EmailJS non configuré. " +
        "Définissez VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY dans .env " +
        "pour activer l'envoi d'emails réels.",
    );
    return { success: true, simulated: true };
  }

  try {
    // Générer le QR code en base64 pour l'email
    let qrImageUrl = "";
    try {
      qrImageUrl = await generateQrDataUrl(card.qrToken);
    } catch {
      // Le QR n'est pas bloquant pour l'email
      qrImageUrl = "";
    }

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: customer.email,
        to_name: customer.name,
        business_name: businessName,
        points: card.points,
        qr_token: card.qrToken,
        qr_image_url: qrImageUrl,
        card_id: card.id,
        join_date: new Date(card.createdAt).toLocaleDateString("fr-FR"),
      },
      publicKey,
    );

    return { success: true };
  } catch (err) {
    console.error("[M3ak EmailService] Erreur envoi email:", err);
    return { success: false };
  }
}

/**
 * Renvoi de la carte existante (même token, même carte).
 * NE crée PAS une nouvelle carte.
 */
export async function resendLoyaltyCardEmail(payload: EmailCardPayload): Promise<{ success: boolean; simulated?: boolean }> {
  return sendLoyaltyCardEmail(payload);
}
