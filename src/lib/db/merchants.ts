/**
 * db/merchants.ts — CRUD commerçants
 */
import { supabase } from "../supabase";
import type { Merchant } from "../auth";

export type MerchantUpdate = Partial<Pick<Merchant,
  "name" | "category" | "email" | "phone" | "address" | "logo_url" | "slug"
>>;

/** Récupère le commerce du commerçant connecté */
export async function getMyMerchant(): Promise<Merchant | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("owner_id", user.id)
    .single();

  return data as Merchant | null;
}

/** Récupère un commerce par son slug (public) */
export async function getMerchantBySlug(slug: string): Promise<Merchant | null> {
  const { data } = await supabase
    .from("merchants")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();
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
  return data ?? [];
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
