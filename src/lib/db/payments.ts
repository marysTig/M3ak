/**
 * db/payments.ts — Gestion des encaissements d'abonnements des commerces (Admin)
 */
import { supabase } from "../supabase";
import type { ActivationDuration } from "./merchants";

export type PaymentMethod = "cash" | "baridimob" | "ccp" | "check" | "transfer";

export interface SubscriptionPayment {
  id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_phone?: string | null;
  amount: number;
  duration: ActivationDuration;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
}

const LOCAL_STORAGE_KEY = "m3ak_subscription_payments";

function getLocalPayments(): SubscriptionPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPayments(items: SubscriptionPayment[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignoré
  }
}

/** Récupère la liste de tous les encaissements enregistrés */
export async function getSubscriptionPayments(): Promise<SubscriptionPayment[]> {
  try {
    const { data, error } = await supabase
      .from("subscription_payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Synchroniser localement
      saveLocalPayments(data as SubscriptionPayment[]);
      return data as SubscriptionPayment[];
    }
  } catch {
    // Repli sur le stockage local
  }
  return getLocalPayments();
}

/** Enregistre un nouvel encaissement pour un commerce */
export async function recordSubscriptionPayment(payload: {
  merchant_id: string;
  merchant_name: string;
  merchant_phone?: string | null;
  amount: number;
  duration: ActivationDuration;
  payment_method: PaymentMethod;
  notes?: string;
}): Promise<SubscriptionPayment> {
  const newRecord: SubscriptionPayment = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `pay_${Date.now()}`,
    ...payload,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("subscription_payments")
      .insert({
        id: newRecord.id,
        merchant_id: newRecord.merchant_id,
        merchant_name: newRecord.merchant_name,
        merchant_phone: newRecord.merchant_phone,
        amount: newRecord.amount,
        duration: newRecord.duration,
        payment_method: newRecord.payment_method,
        notes: newRecord.notes,
        created_at: newRecord.created_at,
      })
      .select()
      .single();

    if (!error && data) {
      const saved = data as SubscriptionPayment;
      const local = getLocalPayments();
      saveLocalPayments([saved, ...local.filter((p) => p.id !== saved.id)]);
      return saved;
    }
  } catch {
    // Si la table distante n'est pas encore migrée, on sauvegarde en local
  }

  const local = getLocalPayments();
  const updated = [newRecord, ...local];
  saveLocalPayments(updated);
  return newRecord;
}

/** Supprime un encaissement */
export async function deleteSubscriptionPayment(id: string): Promise<void> {
  try {
    await supabase.from("subscription_payments").delete().eq("id", id);
  } catch {
    // ignoré
  }
  const local = getLocalPayments().filter((p) => p.id !== id);
  saveLocalPayments(local);
}
