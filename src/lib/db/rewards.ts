/**
 * db/rewards.ts — CRUD récompenses
 */
import { supabase } from "../supabase";

export interface Reward {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  icon: string;
  points_cost: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  // Calculé côté client depuis reward_redemptions
  redeemed_count?: number;
}

/** Récompenses d'un commerce */
export async function getMerchantRewards(merchantId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select(`
      *,
      reward_redemptions!reward_redemptions_reward_id_fkey (id)
    `)
    .eq("merchant_id", merchantId)
    .order("created_at");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    merchant_id: r.merchant_id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    points_cost: r.points_cost,
    active: r.active,
    created_at: r.created_at,
    updated_at: r.updated_at,
    redeemed_count: Array.isArray(r.reward_redemptions)
      ? r.reward_redemptions.length
      : 0,
  }));
}

/** Crée une récompense */
export async function createReward(
  merchantId: string,
  params: {
    name: string;
    description: string;
    icon?: string;
    points_cost: number;
    active?: boolean;
  },
): Promise<Reward> {
  const { data, error } = await supabase
    .from("rewards")
    .insert({
      merchant_id: merchantId,
      name: params.name,
      description: params.description,
      icon: params.icon ?? "gift",
      points_cost: params.points_cost,
      active: params.active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Reward;
}

/** Met à jour une récompense */
export async function updateReward(
  rewardId: string,
  params: {
    name?: string;
    description?: string;
    icon?: string;
    points_cost?: number;
    active?: boolean;
  },
): Promise<Reward> {
  const { data, error } = await supabase
    .from("rewards")
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq("id", rewardId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Reward;
}

/** Supprime une récompense */
export async function deleteReward(rewardId: string) {
  const { error } = await supabase.from("rewards").delete().eq("id", rewardId);
  if (error) throw new Error(error.message);
}

/** Récompenses disponibles pour un client sur une carte donnée */
export async function getAvailableRewards(merchantId: string, currentPoints: number) {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("active", true)
    .order("points_cost");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    ...r,
    ready: currentPoints >= r.points_cost,
    missing: Math.max(0, r.points_cost - currentPoints),
  }));
}
