import { supabase } from "@/lib/supabase";
import type { Commission, CommissionPayout, CommissionStatus } from "@/lib/types/prospection";

export async function getCommissions(filters?: {
  status?: string;
  prospectorId?: string;
}): Promise<Commission[]> {
  try {
    let q = supabase
      .from("commissions")
      .select(`
        *,
        prospector:profiles!commissions_prospector_id_fkey(full_name),
        prospect:prospects(business_name),
        merchant:merchants(name)
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters?.prospectorId && filters.prospectorId !== "all") {
      q = q.eq("prospector_id", filters.prospectorId);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("Erreur getCommissions :", error.message);
      return [];
    }

    return (data ?? []).map((c: any) => ({
      id: c.id,
      prospector_id: c.prospector_id,
      prospector_name: c.prospector?.full_name || "Prospecteur inconnu",
      prospect_id: c.prospect_id,
      prospect_name: c.prospect?.business_name,
      merchant_id: c.merchant_id,
      merchant_name: c.merchant?.name,
      payment_id: c.payment_id,
      amount: Number(c.amount) || 1500,
      client_paid_amount: Number(c.client_paid_amount) || 2500,
      plan_duration: c.plan_duration,
      status: c.status as CommissionStatus,
      paid_at: c.paid_at,
      payment_reference: c.payment_reference,
      notes: c.notes,
      created_at: c.created_at,
    }));
  } catch (err) {
    console.error("Erreur getCommissions :", err);
    return [];
  }
}

export async function getCommissionPayouts(prospectorId?: string): Promise<CommissionPayout[]> {
  try {
    let q = supabase
      .from("commission_payouts")
      .select(`
        *,
        prospector:profiles!commission_payouts_prospector_id_fkey(full_name)
      `)
      .order("paid_at", { ascending: false });

    if (prospectorId && prospectorId !== "all") {
      q = q.eq("prospector_id", prospectorId);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("Erreur getCommissionPayouts :", error.message);
      return [];
    }

    return (data ?? []).map((p: any) => ({
      id: p.id,
      prospector_id: p.prospector_id,
      prospector_name: p.prospector?.full_name || "Prospecteur inconnu",
      amount: Number(p.amount) || 0,
      payment_method: p.payment_method,
      reference: p.reference,
      paid_at: p.paid_at,
      notes: p.notes,
      created_at: p.created_at,
    }));
  } catch (err) {
    console.error("Erreur getCommissionPayouts :", err);
    return [];
  }
}

export async function recordCommissionPayout(payload: {
  prospector_id: string;
  amount: number;
  payment_method: "cash" | "ccp" | "baridimob" | "bank_transfer";
  reference: string;
  notes?: string;
  commission_ids?: string[];
}): Promise<CommissionPayout> {
  // 1. Enregistrer le bordereau de versement
  const { data, error } = await supabase
    .from("commission_payouts")
    .insert({
      prospector_id: payload.prospector_id,
      amount: payload.amount,
      payment_method: payload.payment_method,
      reference: payload.reference.trim(),
      notes: payload.notes?.trim() || null,
      paid_at: new Date().toISOString(),
    })
    .select(`
      *,
      prospector:profiles!commission_payouts_prospector_id_fkey(full_name)
    `)
    .single();

  if (error) throw new Error(error.message);

  // 2. Si des commissions spécifiques ont été sélectionnées, les marquer comme payées
  if (payload.commission_ids && payload.commission_ids.length > 0) {
    await supabase
      .from("commissions")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        payment_reference: payload.reference.trim(),
      })
      .in("id", payload.commission_ids);
  }

  return {
    id: data.id,
    prospector_id: data.prospector_id,
    prospector_name: data.prospector?.full_name,
    amount: Number(data.amount),
    payment_method: data.payment_method,
    reference: data.reference,
    paid_at: data.paid_at,
    notes: data.notes,
    created_at: data.created_at,
  };
}

export async function updateCommissionStatus(
  id: string,
  status: CommissionStatus,
  reference?: string
): Promise<boolean> {
  const updates: Record<string, any> = { status };
  if (status === "paid") {
    updates.paid_at = new Date().toISOString();
    if (reference) updates.payment_reference = reference;
  }

  const { error } = await supabase.from("commissions").update(updates).eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

