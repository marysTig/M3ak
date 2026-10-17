/**
 * db/program.ts — Programme de fidélité (thème, règles, statut)
 */
import { supabase } from "../supabase";

export interface LoyaltyProgram {
  id: string;
  merchant_id: string;
  name: string;
  theme_id: string;
  points_per_euro: number;
  status: "active" | "suspended";
  email_notif: boolean;
  reward_notif: boolean;
  created_at: string;
  updated_at: string;
}

/** Récupère le programme d'un commerce */
export async function getLoyaltyProgram(merchantId: string): Promise<LoyaltyProgram | null> {
  const { data } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("merchant_id", merchantId)
    .single();
  return data as LoyaltyProgram | null;
}

/** Crée le programme si inexistant */
export async function ensureLoyaltyProgram(merchantId: string): Promise<LoyaltyProgram> {
  const existing = await getLoyaltyProgram(merchantId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("loyalty_programs")
    .insert({ merchant_id: merchantId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as LoyaltyProgram;
}

/** Sauvegarde le thème de la carte */
export async function saveTheme(merchantId: string, themeId: string): Promise<void> {
  const { error } = await supabase
    .from("loyalty_programs")
    .upsert(
      { merchant_id: merchantId, theme_id: themeId, updated_at: new Date().toISOString() },
      { onConflict: "merchant_id" }
    );
  if (error) throw new Error(error.message);
}

/** Met à jour les paramètres du programme */
export async function updateProgram(
  merchantId: string,
  updates: Partial<Pick<LoyaltyProgram,
    "name" | "theme_id" | "points_per_euro" | "email_notif" | "reward_notif"
  >>
): Promise<LoyaltyProgram> {
  const { data, error } = await supabase
    .from("loyalty_programs")
    .upsert(
      { merchant_id: merchantId, ...updates, updated_at: new Date().toISOString() },
      { onConflict: "merchant_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as LoyaltyProgram;
}

/** Suspend ou réactive le programme */
export async function setProgramStatus(
  merchantId: string,
  status: "active" | "suspended"
): Promise<void> {
  const { error } = await supabase
    .from("loyalty_programs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("merchant_id", merchantId);
  if (error) throw new Error(error.message);
}
