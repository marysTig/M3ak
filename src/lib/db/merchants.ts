/**
 * db/merchants.ts — CRUD commerçants
 */
import { supabase } from "../supabase";
import type { Merchant } from "../auth";

export type MerchantUpdate = Partial<Pick<Merchant,
  "name" | "category" | "email" | "phone" | "address" | "logo_url" | "slug"
>>;

/** Durée d'activation : 1 mois ou 1 an */
export type ActivationDuration = "1month" | "1year";

/** Active un commerce pour 1 mois ou 1 an */
export async function activateMerchant(merchantId: string, duration: ActivationDuration) {
  const now = new Date();
  const expires = new Date(now);
  if (duration === "1year") {
    expires.setFullYear(expires.getFullYear() + 1);
  } else {
    expires.setDate(now.getDate() + 30);
  }

  const { data, error } = await supabase
    .from("merchants")
    .update({
      status: "active",
      subscription_expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Merchant;
}

/** Récupère le commerce du commerçant connecté */
export async function getMyMerchant(): Promise<Merchant | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();

  // Si la fiche n'existe pas encore pour ce commerçant, on la crée automatiquement
  if (!data && user.user_metadata?.role === "merchant") {
    const rawUser = (user.email ?? "").replace("@m3ak.app", "") || "moncommerce";
    const name = user.user_metadata?.full_name || rawUser;
    const slug = rawUser.toLowerCase().replace(/[^a-z0-9]/g, "-");

    const { data: created } = await supabase
      .from("merchants")
      .upsert({
        owner_id: user.id,
        name,
        slug,
        status: "active",
        plan: "starter",
      }, { onConflict: "slug" })
      .select()
      .maybeSingle();

    if (created) data = created;
  }

  // Désactivation automatique si la date d'abonnement est expirée
  if (data && data.subscription_expires_at) {
    const isExpired = new Date(data.subscription_expires_at).getTime() <= Date.now();
    if (isExpired && data.status === "active") {
      data.status = "suspended";
      supabase
        .from("merchants")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("id", data.id)
        .then();
    }
  }

  return data as Merchant | null;
}

/** Récupère un commerce par son slug (public) */
export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  return data as Merchant | null;
}

/** Met à jour les informations du commerce */
export async function updateMerchant(merchantId: string, updates: MerchantUpdate) {
  const { data, error } = await supabase
    .from("merchants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Merchant;
}

/** Liste tous les commerces (admin) */
export async function getAllMerchants(status?: "active" | "pending" | "suspended") {
  let q = supabase.from("merchants").select(`
    *,
    loyalty_cards (count)
  `).order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const now = Date.now();
  const list = (data ?? []).map((m) => {
    // Si l'abonnement a expiré et qu'il était actif, le passer en suspended automatiquement
    if (m.subscription_expires_at && new Date(m.subscription_expires_at).getTime() <= now && m.status === "active") {
      m.status = "suspended";
      supabase
        .from("merchants")
        .update({ status: "suspended", updated_at: new Date().toISOString() })
        .eq("id", m.id)
        .then();
    }
    return m;
  });

  return list;
}

/** Changer le statut d'un commerce (admin) */
export async function setMerchantStatus(
  merchantId: string,
  status: "active" | "pending" | "suspended",
) {
  const { data, error } = await supabase
    .from("merchants")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Merchant;
}

/** Récupère les commerces actifs (pour le discover) */
export async function getActiveBusinesses() {
  const { data, error } = await supabase
    .from("merchants")
    .select("id, name, category, slug, logo_url")
    .eq("status", "active")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Suppression définitive d'un commerce et de son compte utilisateur (admin) */
export async function deleteMerchant(merchantId: string, ownerId?: string) {
  // 1. Tenter via la fonction RPC sécurisée (qui nettoie tout en cascade + auth.users)
  const { error: rpcError } = await supabase.rpc("delete_merchant_account", {
    p_merchant_id: merchantId,
  });

  if (!rpcError) {
    return true;
  }

  console.warn("delete_merchant_account RPC non disponible, repli sur suppression directe:", rpcError.message);

  // Fallback: suppression ordonnée sur les tables publiques si RPC n'est pas encore exécuté dans SQL Editor
  // Supprimer les redemptions liées aux cartes du commerce
  const { data: cards } = await supabase
    .from("loyalty_cards")
    .select("id")
    .eq("merchant_id", merchantId);

  if (cards && cards.length > 0) {
    const cardIds = cards.map((c) => c.id);
    await supabase.from("reward_redemptions").delete().in("card_id", cardIds);
  }

  // Supprimer les transactions
  await supabase.from("transactions").delete().eq("merchant_id", merchantId);

  // Supprimer les cartes de fidélité
  await supabase.from("loyalty_cards").delete().eq("merchant_id", merchantId);

  // Supprimer les récompenses
  await supabase.from("rewards").delete().eq("merchant_id", merchantId);

  // Supprimer le programme de fidélité
  await supabase.from("loyalty_programs").delete().eq("merchant_id", merchantId);

  // Supprimer les points de vente
  await supabase.from("stores").delete().eq("merchant_id", merchantId);

  // Supprimer la fiche commerce
  const { error: merchError } = await supabase
    .from("merchants")
    .delete()
    .eq("id", merchantId);

  if (merchError) {
    throw new Error(merchError.message);
  }

  // Supprimer le profil si ownerId est fourni
  if (ownerId) {
    await supabase.from("profiles").delete().eq("id", ownerId);
  }

  return true;
}
