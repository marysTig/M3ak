/**
 * db/cards.ts — Loyalty cards & scan QR
 */
import { supabase } from "../supabase";

export interface LoyaltyCard {
  id: string;
  customer_id: string;
  merchant_id: string;
  store_id: string | null;
  qr_token: string;
  points: number;
  total_earned: number;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface CardWithProfile extends LoyaltyCard {
  profiles: { full_name: string; id: string } | null;
}

/** Résoudre un QR token (depuis le scan commerçant) via RPC */
export async function resolveQrToken(token: string): Promise<{
  card: LoyaltyCard;
  customerName: string;
  customerEmail: string;
} | null> {
  // Le commerçant lit la carte via son token — RLS garantit qu'il ne voit que les siennes
  const { data, error } = await supabase
    .from("loyalty_cards")
    .select(`
      *,
      profiles!loyalty_cards_customer_id_fkey (
        id, full_name
      )
    `)
    .eq("qr_token", token)
    .single();

  if (error || !data) return null;

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  // Récupérer l'email depuis auth.users via profile
  // On utilise une jointure sur profiles pour avoir le full_name
  // L'email vient de l'utilisateur lui-même (pas stocké dans profiles)
  return {
    card: {
      id: data.id,
      customer_id: data.customer_id,
      merchant_id: data.merchant_id,
      store_id: data.store_id,
      qr_token: data.qr_token,
      points: data.points,
      total_earned: data.total_earned,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    customerName: profile?.full_name ?? "Client",
    customerEmail: "",
  };
}

/** Ajoute des points via RPC atomique */
export async function addPoints(params: {
  qrToken: string;
  points: number;
  description?: string;
}): Promise<{
  card_id: string;
  customer_id: string;
  previous_balance: number;
  points_added: number;
  new_balance: number;
  transaction_id: string;
  created_at: string;
}> {
  const { data, error } = await supabase.rpc("add_points", {
    p_qr_token: params.qrToken,
    p_points: params.points,
    p_description: params.description ?? "",
  });

  if (error) throw new Error(error.message);
  return data as ReturnType<typeof addPoints> extends Promise<infer R> ? R : never;
}

/** Récupère toutes les cartes d'un commerce (avec nom du client) */
export async function getMerchantCards(merchantId: string): Promise<CardWithProfile[]> {
  const { data, error } = await supabase
    .from("loyalty_cards")
    .select(`
      *,
      profiles!loyalty_cards_customer_id_fkey (id, full_name)
    `)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CardWithProfile[];
}

/** Crée une carte manuellement (par le commerçant) */
export async function createCardForCustomer(params: {
  customerEmail: string;
  customerName: string;
  merchantId: string;
  storeId?: string;
  themeId?: string;
}): Promise<{ card: LoyaltyCard; isNew: boolean }> {
  // 1. Chercher ou créer le profil du client par email
  // On ne peut pas chercher par email directement (auth.users n'est pas accessible en RLS)
  // → On utilise un magic link / invitation (out of scope ici)
  // Pour la création manuelle, on cherche dans profiles via email stocké dans auth.users
  // La solution pragmatique : inviter le client par email
  throw new Error(
    "La création de carte se fait via invitation. Utilisez createCardViaInvite()",
  );
}

/** Récupère les cartes du client connecté */
export async function getMyCards() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("loyalty_cards")
    .select(`
      *,
      merchants!loyalty_cards_merchant_id_fkey (
        id, name, category, logo_url, slug
      ),
      rewards!rewards_merchant_id_fkey (
        id, name, points_cost, active
      )
    `)
    .eq("customer_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Rejoindre un commerce via son slug (RPC) */
export async function joinMerchant(slug: string) {
  const { data, error } = await supabase.rpc("join_merchant", {
    p_merchant_slug: slug,
  });
  if (error) throw new Error(error.message);
  return data as {
    already_member: boolean;
    card_id: string;
    merchant_name: string;
    merchant_id: string;
    qr_token: string;
  };
}

/** Échange une récompense (RPC atomique) */
export async function redeemReward(cardId: string, rewardId: string) {
  const { data, error } = await supabase.rpc("redeem_reward", {
    p_card_id: cardId,
    p_reward_id: rewardId,
  });
  if (error) throw new Error(error.message);
  return data as {
    redemption_id: string;
    card_id: string;
    reward_name: string;
    points_spent: number;
    previous_balance: number;
    new_balance: number;
    transaction_id: string;
  };
}
