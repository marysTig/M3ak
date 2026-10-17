/**
 * db/transactions.ts — Transactions points
 */
import { supabase } from "../supabase";

export interface Transaction {
  id: string;
  card_id: string;
  merchant_id: string;
  store_id: string | null;
  created_by: string | null;
  points_delta: number;
  tx_type: "earned" | "redeemed" | "adjustment" | "welcome";
  description: string;
  previous_balance: number;
  new_balance: number;
  created_at: string;
  // jointure
  profiles?: { full_name: string } | null;
  merchants?: { name: string } | null;
}

/** Transactions d'un commerce (pour le commerçant) */
export async function getMerchantTransactions(merchantId: string, limit = 50): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      profiles!transactions_created_by_fkey (full_name),
      loyalty_cards!transactions_card_id_fkey (
        profiles!loyalty_cards_customer_id_fkey (full_name)
      )
    `)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

/** Transactions du client connecté (toutes cartes confondues) */
export async function getMyTransactions(limit = 50): Promise<Transaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Récupérer les card IDs du client
  const { data: cards } = await supabase
    .from("loyalty_cards")
    .select("id")
    .eq("customer_id", user.id);

  if (!cards?.length) return [];

  const cardIds = cards.map((c) => c.id);

  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      merchants!transactions_merchant_id_fkey (name)
    `)
    .in("card_id", cardIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

/** Transactions d'une carte spécifique */
export async function getCardTransactions(cardId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Transaction[];
}

/** Stats agrégées d'un commerce (pour analytics) */
export async function getMerchantStats(merchantId: string) {
  // Nombre de clients (cartes actives)
  const { count: totalCards } = await supabase
    .from("loyalty_cards")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId);

  // Cartes avec activité récente (90 jours)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: activeCards } = await supabase
    .from("loyalty_cards")
    .select("*", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("status", "active")
    .gte("updated_at", ninetyDaysAgo);

  // Points émis total
  const { data: pointsData } = await supabase
    .from("transactions")
    .select("points_delta")
    .eq("merchant_id", merchantId)
    .in("tx_type", ["earned", "welcome", "adjustment"]);

  const pointsIssued = (pointsData ?? [])
    .filter((t) => t.points_delta > 0)
    .reduce((sum, t) => sum + t.points_delta, 0);

  // Points échangés
  const { data: redeemedData } = await supabase
    .from("transactions")
    .select("points_delta")
    .eq("merchant_id", merchantId)
    .eq("tx_type", "redeemed");

  const pointsRedeemed = (redeemedData ?? [])
    .reduce((sum, t) => sum + Math.abs(t.points_delta), 0);

  // Récompenses échangées (count)
  const { count: rewardsRedeemed } = await supabase
    .from("reward_redemptions")
    .select("*", { count: "exact", head: true })
    .in("card_id",
      await supabase.from("loyalty_cards").select("id").eq("merchant_id", merchantId)
        .then(({ data }) => (data ?? []).map((c) => c.id))
    );

  return {
    totalCustomers: totalCards ?? 0,
    activeCustomers: activeCards ?? 0,
    pointsIssued,
    pointsRedeemed,
    rewardsRedeemed: rewardsRedeemed ?? 0,
    redemptionRate: pointsIssued > 0
      ? Math.round((pointsRedeemed / pointsIssued) * 100 * 10) / 10
      : 0,
  };
}

/** Activité mensuelle des 6 derniers mois (pour les graphiques) */
export async function getMerchantGrowthSeries(merchantId: string) {
  const months: { month: string; customers: number; issued: number; redeemed: number }[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString();
    const label = d.toLocaleDateString("fr-FR", { month: "short" });

    const [{ count: customers }, { data: txData }] = await Promise.all([
      supabase.from("loyalty_cards")
        .select("*", { count: "exact", head: true })
        .eq("merchant_id", merchantId)
        .lte("created_at", end),
      supabase.from("transactions")
        .select("points_delta, tx_type")
        .eq("merchant_id", merchantId)
        .gte("created_at", start)
        .lte("created_at", end),
    ]);

    const issued = (txData ?? [])
      .filter((t) => t.points_delta > 0)
      .reduce((s, t) => s + t.points_delta, 0);
    const redeemed = (txData ?? [])
      .filter((t) => t.points_delta < 0)
      .reduce((s, t) => s + Math.abs(t.points_delta), 0);

    months.push({ month: label, customers: customers ?? 0, issued, redeemed });
  }

  return months;
}

/** Répartition des récompenses échangées (pour le graphique bar) */
export async function getRedemptionMix(merchantId: string) {
  const { data, error } = await supabase
    .from("reward_redemptions")
    .select(`
      rewards!reward_redemptions_reward_id_fkey (name),
      card_id
    `)
    .in("card_id",
      await supabase.from("loyalty_cards").select("id").eq("merchant_id", merchantId)
        .then(({ data }) => (data ?? []).map((c) => c.id))
    );

  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    const reward = Array.isArray(r.rewards) ? r.rewards[0] : r.rewards;
    const name = (reward as { name: string } | null)?.name ?? "Inconnu";
    counts[name] = (counts[name] ?? 0) + 1;
  });

  return Object.entries(counts).map(([reward, count]) => ({ reward, count }));
}

/** Stats admin globales */
export async function getAdminStats() {
  const [
    { count: businesses },
    { count: customers },
    { data: pointsData },
  ] = await Promise.all([
    supabase.from("merchants").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
    supabase.from("transactions").select("points_delta").gt("points_delta", 0),
  ]);

  const totalPoints = (pointsData ?? []).reduce((s, t) => s + t.points_delta, 0);

  return {
    businesses: businesses ?? 0,
    customers: customers ?? 0,
    pointsIssued: totalPoints,
  };
}
