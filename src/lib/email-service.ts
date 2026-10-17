/**
 * email-service.ts — v2
 *
 * Service d'envoi d'emails via EmailJS.
 * Découplé de loyalty-store — accepte des types simples.
 */

import emailjs from "@emailjs/browser";
import { generateQrDataUrl } from "./qr-utils";

export interface EmailCardPayload {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  card: {
    id: string;
    qrToken: string;
    points: number;
    createdAt?: string;
  };
  businessName?: string;
}

function isEmailConfigured(): boolean {
  const serviceId = import.meta.env['VITE_EMAILJS_SERVICE_ID'];
  const templateId = import.meta.env['VITE_EMAILJS_TEMPLATE_ID'];
  const publicKey = import.meta.env['VITE_EMAILJS_PUBLIC_KEY'];
  return !!(serviceId && templateId && publicKey);
}

/**
 * Envoie la carte virtuelle au client par email.
 * Si EmailJS n'est pas configuré, simule le succès.
 */
export async function sendLoyaltyCardEmail(
  payload: EmailCardPayload,
): Promise<{ success: boolean; simulated?: boolean }> {
  const { customer, card, businessName = "M3ak Loyalty" } = payload;

  if (!isEmailConfigured()) {
    console.warn(
      "[M3ak EmailService] EmailJS non configuré. " +
        "Définissez VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY dans .env.",
    );
    return { success: true, simulated: true };
  }

  try {
    let qrImageUrl = "";
    try {
      qrImageUrl = await generateQrDataUrl(card.qrToken);
    } catch {
      qrImageUrl = "";
    }

    const serviceId = import.meta.env['VITE_EMAILJS_SERVICE_ID'];
    const templateId = import.meta.env['VITE_EMAILJS_TEMPLATE_ID'];
    const publicKey = import.meta.env['VITE_EMAILJS_PUBLIC_KEY'];

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
        join_date: card.createdAt
          ? new Date(card.createdAt).toLocaleDateString("fr-FR")
          : new Date().toLocaleDateString("fr-FR"),
      },
      publicKey,
    );

    return { success: true };
  } catch (err) {
    console.error("[M3ak EmailService] Erreur envoi email:", err);
    return { success: false };
  }
}

/** Alias pour renvoi de carte */
export async function resendLoyaltyCardEmail(
  payload: EmailCardPayload,
): Promise<{ success: boolean; simulated?: boolean }> {
  return sendLoyaltyCardEmail(payload);
}
