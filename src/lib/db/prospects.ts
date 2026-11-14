import { supabase } from "@/lib/supabase";
import type { Prospect, ProspectStatus, ProspectionKPIs } from "@/lib/types/prospection";

export async function getProspects(filters?: {
  status?: string;
  wilaya?: string;
  prospectorId?: string;
  search?: string;
}): Promise<Prospect[]> {
  try {
    let q = supabase
      .from("prospects")
      .select(`
        *,
        assigned_prospector:profiles!prospects_assigned_to_fkey(id, full_name, phone)
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters?.wilaya && filters.wilaya !== "all") {
      q = q.eq("wilaya", filters.wilaya);
    }
    if (filters?.prospectorId && filters.prospectorId !== "all") {
      q = q.eq("assigned_to", filters.prospectorId);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("Table prospects non encore initialisée ou vide :", error.message);
      return [];
    }

    let list = (data ?? []) as unknown as Prospect[];

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.business_name?.toLowerCase().includes(s) ||
          p.phone?.toLowerCase().includes(s) ||
          p.category?.toLowerCase().includes(s) ||
          p.wilaya?.toLowerCase().includes(s) ||
          p.contact_name?.toLowerCase().includes(s) ||
          p.assigned_prospector?.full_name?.toLowerCase().includes(s)
      );
    }

    return list;
  } catch (err) {
    console.error("Erreur getProspects :", err);
    return [];
  }
}

export async function getProspectById(id: string): Promise<Prospect | null> {
  const { data, error } = await supabase
    .from("prospects")
    .select(`
      *,
      assigned_prospector:profiles!prospects_assigned_to_fkey(id, full_name, phone)
    `)
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as Prospect;
}

export async function createProspect(payload: {
  business_name: string;
  phone: string;
  wilaya: string;
  category?: string;
  commune?: string;
  address?: string;
  contact_name?: string;
  email?: string;
  notes?: string;
  assigned_to?: string;
  status?: ProspectStatus;
}): Promise<Prospect> {
  const { data, error } = await supabase
    .from("prospects")
    .insert({
      business_name: payload.business_name.trim(),
      phone: payload.phone.trim(),
      wilaya: payload.wilaya,
      category: payload.category?.trim() || null,
      commune: payload.commune?.trim() || null,
      address: payload.address?.trim() || null,
      contact_name: payload.contact_name?.trim() || null,
      email: payload.email?.trim() || null,
      notes: payload.notes?.trim() || null,
      assigned_to: payload.assigned_to || null,
      status: payload.status || "new",
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}

export async function updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
  const { data, error } = await supabase
    .from("prospects")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<Prospect> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "trial") {
    updates.trial_started_at = new Date().toISOString();
    updates.trial_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Prospect;
}

export async function assignProspects(
  prospectIds: string[],
  prospectorId: string | null,
  assignedBy?: string
): Promise<number> {
  if (prospectIds.length === 0) return 0;

  const { error } = await supabase
    .from("prospects")
    .update({
      assigned_to: prospectorId,
      updated_at: new Date().toISOString(),
    })
    .in("id", prospectIds);

  if (error) throw new Error(error.message);

  // Enregistrer dans l'historique d'attribution
  if (prospectorId) {
    const historyRows = prospectIds.map((pid) => ({
      prospect_id: pid,
      assigned_to: prospectorId,
      assigned_by: assignedBy || null,
      notes: "Attribution en masse depuis le tableau CRM",
    }));

    await supabase.from("prospect_assignment_history").insert(historyRows);
  }

  return prospectIds.length;
}

export async function importProspectsBatch(
  rows: {
    business_name: string;
    phone: string;
    wilaya: string;
    category?: string;
    commune?: string;
    address?: string;
    contact_name?: string;
    email?: string;
    notes?: string;
    assigned_to?: string;
    status?: ProspectStatus;
  }[]
): Promise<{ inserted: number; rejected: number; duplicates: number }> {
  if (rows.length === 0) return { inserted: 0, rejected: 0, duplicates: 0 };

  // 1. Lire les téléphones déjà enregistrés pour détecter les doublons
  const { data: existing } = await supabase
    .from("prospects")
    .select("phone");

  const existingPhones = new Set((existing ?? []).map((p: { phone: string }) => p.phone?.replace(/[^0-9]/g, "")));

  const toInsert: any[] = [];
  let duplicates = 0;
  let rejected = 0;

  for (const r of rows) {
    const cleanPhone = (r.phone || "").replace(/[^0-9]/g, "");
    if (!r.business_name || !cleanPhone || cleanPhone.length < 8 || !r.wilaya) {
      rejected++;
      continue;
    }

    if (existingPhones.has(cleanPhone)) {
      duplicates++;
      continue;
    }

    existingPhones.add(cleanPhone);
    toInsert.push({
      business_name: r.business_name.trim(),
      phone: r.phone.trim(),
      wilaya: r.wilaya,
      category: r.category?.trim() || "Général",
      commune: r.commune?.trim() || null,
      address: r.address?.trim() || null,
      contact_name: r.contact_name?.trim() || null,
      email: r.email?.trim() || null,
      notes: r.notes?.trim() || null,
      assigned_to: r.assigned_to || null,
      status: r.status || "new",
      updated_at: new Date().toISOString(),
    });
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("prospects").insert(toInsert);
    if (error) throw new Error(error.message);
  }

  return {
    inserted: toInsert.length,
    rejected,
    duplicates,
  };
}

export async function deleteProspect(id: string): Promise<boolean> {
  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

export async function getProspectionKPIs(): Promise<ProspectionKPIs> {
  try {
    const [prospectsRes, prospectorsRes, commissionsRes] = await Promise.all([
      supabase.from("prospects").select("id, status"),
      supabase.from("profiles").select("id").eq("role", "prospector"),
      supabase.from("commissions").select("amount, status"),
    ]);

    const prospects = prospectsRes.data ?? [];
    const totalProspects = prospects.length;
    const newProspects = prospects.filter((p) => p.status === "new").length;
    const trialsActive = prospects.filter((p) => p.status === "trial").length;
    const convertedTotal = prospects.filter((p) => p.status === "converted").length;

    const conversionRate = totalProspects > 0 ? Math.round((convertedTotal / totalProspects) * 100) : 0;

    const commissions = commissionsRes.data ?? [];
    const totalCommissionsDue = commissions
      .filter((c) => c.status === "pending" || c.status === "approved")
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    const totalCommissionsPaid = commissions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    const activeProspectors = (prospectorsRes.data ?? []).length;

    return {
      totalProspects,
      newProspects,
      trialsActive,
      convertedTotal,
      conversionRate,
      totalCommissionsDue,
      totalCommissionsPaid,
      activeProspectors,
    };
  } catch (err) {
    console.error("Erreur getProspectionKPIs :", err);
    return {
      totalProspects: 0,
      newProspects: 0,
      trialsActive: 0,
      convertedTotal: 0,
      conversionRate: 0,
      totalCommissionsDue: 0,
      totalCommissionsPaid: 0,
      activeProspectors: 0,
    };
  }
}

