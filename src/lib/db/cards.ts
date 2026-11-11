/**
 * db/cards.ts — Loyalty cards & scan QR
 */
import { supabase } from "../supabase";

export type CardType = "points" | "vip" | "stamps";
export type VipTier = "bronze" | "silver" | "gold";

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

  // Type & configuration
  card_type?: CardType;
  card_name?: string | null;
  theme_id?: string | null;

  // Tampons (Stamps)
  stamps_count?: number;
  stamps_target?: number;
  stamp_reward?: string | null;
  stamp_conditions?: string | null;

  // VIP
  vip_tier?: VipTier;
  vip_spent?: number;
  vip_bronze_threshold?: number;
  vip_silver_threshold?: number;
  vip_gold_threshold?: number;
  vip_bronze_benefits?: string | null;
  vip_silver_benefits?: string | null;
  vip_gold_benefits?: string | null;
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

/** Ajoute des tampons à une carte de type stamps */
export async function addStamps(params: {
  cardId: string;
  count: number;
}): Promise<{ newCount: number; target: number; completed: boolean }> {
  const { data: current, error: fetchErr } = await supabase
    .from("loyalty_cards")
    .select("stamps_count, stamps_target")
    .eq("id", params.cardId)
    .single();

  if (fetchErr || !current) throw new Error(fetchErr?.message || "Carte introuvable");

  const currentCount = Number(current.stamps_count ?? 0);
  const target = Number(current.stamps_target ?? 10);
  const newCount = currentCount + params.count;

  const { error: updateErr } = await supabase
    .from("loyalty_cards")
    .update({ stamps_count: newCount, updated_at: new Date().toISOString() })
    .eq("id", params.cardId);

  if (updateErr) throw new Error(updateErr.message);

  return {
    newCount,
    target,
    completed: newCount >= target,
  };
}

/** Réinitialise ou déduit les tampons après récompense */
export async function redeemStamps(params: {
  cardId: string;
  stampsTarget: number;
}): Promise<{ newCount: number }> {
  const { data: current, error: fetchErr } = await supabase
    .from("loyalty_cards")
    .select("stamps_count")
    .eq("id", params.cardId)
    .single();

  if (fetchErr || !current) throw new Error(fetchErr?.message || "Carte introuvable");

  const currentCount = Number(current.stamps_count ?? 0);
  const target = Number(params.stampsTarget ?? 10);
  const newCount = Math.max(0, currentCount - target);

  const { error: updateErr } = await supabase
    .from("loyalty_cards")
    .update({ stamps_count: newCount, updated_at: new Date().toISOString() })
    .eq("id", params.cardId);

  if (updateErr) throw new Error(updateErr.message);

  return { newCount };
}

/** Ajoute une dépense VIP et recalcule le palier (Bronze / Silver / Gold) */
export async function addVipSpending(params: {
  cardId: string;
  amount: number;
}): Promise<{ newSpent: number; newTier: VipTier; previousTier: VipTier; tierUpgraded: boolean }> {
  const { data: current, error: fetchErr } = await supabase
    .from("loyalty_cards")
    .select("vip_spent, vip_tier, vip_silver_threshold, vip_gold_threshold")
    .eq("id", params.cardId)
    .single();

  if (fetchErr || !current) throw new Error(fetchErr?.message || "Carte introuvable");

  const currentSpent = Number(current.vip_spent ?? 0);
  const previousTier = (current.vip_tier as VipTier) || "bronze";
  const silverThreshold = Number(current.vip_silver_threshold ?? 15000);
  const goldThreshold = Number(current.vip_gold_threshold ?? 30000);

  const newSpent = currentSpent + params.amount;
  let newTier: VipTier = "bronze";
  if (newSpent >= goldThreshold) {
    newTier = "gold";
  } else if (newSpent >= silverThreshold) {
    newTier = "silver";
  } else {
    newTier = "bronze";
  }

  const { error: updateErr } = await supabase
    .from("loyalty_cards")
    .update({
      vip_spent: newSpent,
      vip_tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.cardId);

  if (updateErr) throw new Error(updateErr.message);

  return {
    newSpent,
    newTier,
    previousTier,
    tierUpgraded: newTier !== previousTier,
  };
}

/** Remet les points d'une carte à zéro */
export async function resetCardPoints(cardId: string): Promise<{ new_balance: number }> {
  // 1. Tenter via RPC sécurisée
  try {
    const { data, error } = await supabase.rpc("reset_points", { p_card_id: cardId });
    if (!error && data) {
      return data as { new_balance: number };
    }
  } catch {
    // Fallback ci-dessous
  }

  // 2. Fallback direct sur loyalty_cards
  const { error: updateErr } = await supabase
    .from("loyalty_cards")
    .update({ points: 0, updated_at: new Date().toISOString() })
    .eq("id", cardId);

  if (updateErr) throw new Error(updateErr.message);

  return { new_balance: 0 };
}
