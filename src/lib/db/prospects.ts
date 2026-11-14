import { supabase } from "@/lib/supabase";
import type {
  Prospect,
  ProspectFinale,
  ProspectImport,
  ProspectStatus,
  ProspectionKPIs,
} from "@/lib/types/prospection";

export async function getProspects(filters?: {
  status?: string;
  finale?: string;
  wilaya?: string;
  commune?: string;
  category?: string;
  prospectorId?: string;
  search?: string;
}): Promise<Prospect[]> {
  try {
    let q = supabase
      .from("prospects")
      .select(`
        *,
        prospector:profiles!prospects_assigned_to_fkey(id, full_name, username, phone, wilaya)
      `)
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters?.finale && filters.finale !== "all") {
      if (filters.finale === "none") {
        q = q.is("finale", null);
      } else {
        q = q.eq("finale", filters.finale);
      }
    }
    if (filters?.wilaya && filters.wilaya !== "all") {
      q = q.eq("wilaya", filters.wilaya);
    }
    if (filters?.commune && filters.commune !== "all") {
      q = q.eq("commune", filters.commune);
    }
    if (filters?.category && filters.category !== "all") {
      q = q.eq("category", filters.category);
    }
    if (filters?.prospectorId && filters.prospectorId !== "all") {
      if (filters.prospectorId === "unassigned") {
        q = q.is("assigned_to", null);
      } else {
        q = q.eq("assigned_to", filters.prospectorId);
      }
    }

    const { data, error } = await q;
    if (error) {
      console.warn("Erreur lecture prospects :", error.message);
      return [];
    }

    let list = (data ?? []) as unknown as Prospect[];

    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.business_name?.toLowerCase().includes(s) ||
          p.phone?.toLowerCase().includes(s) ||
          p.commune?.toLowerCase().includes(s) ||
          p.wilaya?.toLowerCase().includes(s) ||
          p.category?.toLowerCase().includes(s) ||
          p.prospector?.full_name?.toLowerCase().includes(s) ||
          p.prospector?.username?.toLowerCase().includes(s)
      );
    }

    return list;
  } catch (err) {
    console.error("Erreur getProspects :", err);
    return [];
  }
}

export async function createProspect(payload: Partial<Prospect>): Promise<Prospect> {
  const { data, error } = await supabase
    .from("prospects")
    .insert({
      business_name: payload.business_name?.trim(),
      phone: payload.phone?.trim(),
      wilaya: payload.wilaya,
      commune: payload.commune?.trim() || null,
      category: payload.category?.trim() || "Commerce",
      status: payload.status || "callback",
      finale: payload.finale || null,
      notes: payload.notes?.trim() || null,
      assigned_to: payload.assigned_to || null,
      assigned_at: payload.assigned_to ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select(`
      *,
      prospector:profiles!prospects_assigned_to_fkey(id, full_name, username, phone, wilaya)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Prospect;
}

export async function updateProspect(id: string, updates: Partial<Prospect>): Promise<Prospect> {
  const { data, error } = await supabase
    .from("prospects")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      prospector:profiles!prospects_assigned_to_fkey(id, full_name, username, phone, wilaya)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Prospect;
}

/**
 * Mise à jour exclusive du STATUT (Géré par le prospecteur ou l'admin)
 */
export async function updateProspectStatus(
  id: string,
  status: ProspectStatus,
  prospectorId?: string
): Promise<Prospect> {
  const updates: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "trial") {
    updates.trial_started_at = new Date().toISOString();
    updates.trial_expires_at = new Date(Date.now() + 7 * 86400000).toISOString();
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      prospector:profiles!prospects_assigned_to_fkey(id, full_name, username, phone, wilaya)
    `)
    .single();

  if (error) throw new Error(error.message);

  // Journaliser l'activité
  try {
    await supabase.from("prospect_activities").insert({
      prospect_id: id,
      prospector_id: prospectorId || null,
      action: "status_change",
      new_value: status,
      details: `Statut modifié vers: ${status}`,
    });
  } catch {
    // Ignorer si table d'activités non créée
  }

  return data as unknown as Prospect;
}

/**
 * Mise à jour exclusive de la colonne FINALE (Géré exclusivement par l'administrateur)
 */
export async function updateProspectFinale(
  id: string,
  finale: ProspectFinale
): Promise<Prospect> {
  const updates: Record<string, any> = {
    finale,
    updated_at: new Date().toISOString(),
  };

  if (finale === "paid") {
    updates.converted_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      prospector:profiles!prospects_assigned_to_fkey(id, full_name, username, phone, wilaya)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as Prospect;
}

/**
 * Attribution de listes de prospects à un prospecteur
 */
export async function assignProspects(
  prospectIds: string[],
  prospectorId: string | null,
  assignedBy?: string
): Promise<boolean> {
  if (prospectIds.length === 0) return true;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("prospects")
    .update({
      assigned_to: prospectorId,
      assigned_at: prospectorId ? now : null,
      updated_at: now,
    })
    .in("id", prospectIds);

  if (error) throw new Error(error.message);

  // Historique d'attribution
  if (prospectorId) {
    const historyRows = prospectIds.map((pid) => ({
      prospect_id: pid,
      prospector_id: prospectorId,
      assigned_by: assignedBy || null,
      assigned_at: now,
      notes: "Attribution de liste",
    }));

    try {
      await supabase.from("prospect_assignments").insert(historyRows);
    } catch {
      // Ignorer si table non créée
    }
  }

  return true;
}

/**
 * Importation complète et attribution par fichier Excel
 */
export async function importAndAssignExcelProspects(params: {
  filename: string;
  imported_by?: string;
  assigned_to?: string | null;
  rows: {
    business_name: string;
    wilaya: string;
    commune: string;
    phone: string;
    category: string;
    status: ProspectStatus;
    finale: ProspectFinale;
  }[];
}): Promise<{
  import_id: string | null;
  insertedCount: number;
  duplicateCount: number;
  rejectedCount: number;
}> {
  const { filename, imported_by, assigned_to, rows } = params;
  if (rows.length === 0) {
    return { import_id: null, insertedCount: 0, duplicateCount: 0, rejectedCount: 0 };
  }

  // 1. Lire les numéros de téléphone existants pour éviter les doublons
  const { data: existing } = await supabase.from("prospects").select("phone");
  const existingPhones = new Set(
    (existing ?? []).map((p: { phone: string }) => p.phone?.replace(/[^0-9]/g, ""))
  );

  // 2. Créer l'enregistrement d'import
  let importId: string | null = null;
  try {
    const { data: importRecord } = await supabase
      .from("prospect_imports")
      .insert({
        filename,
        imported_by: imported_by || null,
        assigned_to: assigned_to || null,
        total_rows: rows.length,
        valid_rows: 0,
      })
      .select("id")
      .single();
    if (importRecord) importId = importRecord.id;
  } catch {
    // Si table n'existe pas encore
  }

  // 3. Filtrer et préparer l'insertion
  const toInsert: any[] = [];
  let duplicateCount = 0;
  let rejectedCount = 0;
  const now = new Date().toISOString();

  for (const r of rows) {
    const cleanP = (r.phone || "").replace(/[^0-9]/g, "");
    if (!r.business_name || !cleanP || cleanP.length < 8) {
      rejectedCount++;
      continue;
    }

    if (existingPhones.has(cleanP)) {
      duplicateCount++;
      continue;
    }

    existingPhones.add(cleanP);
    toInsert.push({
      business_name: r.business_name.trim(),
      wilaya: r.wilaya || "Algérie",
      commune: r.commune || null,
      phone: r.phone.trim(),
      category: r.category || "Commerce",
      status: r.status || "callback",
      finale: r.finale || null,
      assigned_to: assigned_to || null,
      assigned_at: assigned_to ? now : null,
      import_id: importId,
      created_at: now,
      updated_at: now,
    });
  }

  if (toInsert.length > 0) {
    const { data: insertedData, error: insError } = await supabase
      .from("prospects")
      .insert(toInsert)
      .select("id");

    if (insError) throw new Error(insError.message);

    // Mettre à jour le nombre valide dans prospect_imports
    if (importId) {
      await supabase
        .from("prospect_imports")
        .update({ valid_rows: toInsert.length })
        .eq("id", importId);
    }

    // Historique d'attribution si un prospecteur était sélectionné
    if (assigned_to && insertedData && insertedData.length > 0) {
      const assignmentRows = insertedData.map((p) => ({
        prospect_id: p.id,
        prospector_id: assigned_to,
        assigned_by: imported_by || null,
        assigned_at: now,
        notes: `Import Excel: ${filename}`,
      }));

      try {
        await supabase.from("prospect_assignments").insert(assignmentRows);
      } catch {
        // Ignorer
      }
    }
  }

  return {
    import_id: importId,
    insertedCount: toInsert.length,
    duplicateCount,
    rejectedCount,
  };
}

export async function deleteProspect(id: string): Promise<boolean> {
  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

export async function getProspectionKPIs(): Promise<ProspectionKPIs> {
  try {
    const [prospectsRes, commissionsRes] = await Promise.all([
      supabase.from("prospects").select("id, status, finale"),
      supabase.from("commissions").select("amount_da, status"),
    ]);

    const prospects = prospectsRes.data ?? [];
    const total_leads = prospects.length;
    const active_trials = prospects.filter((p) => p.status === "trial").length;
    const conversions = prospects.filter((p) => p.finale === "paid" || p.status === "converted").length;
    const conversion_rate = total_leads > 0 ? Number(((conversions / total_leads) * 100).toFixed(1)) : 0;

    const commissions = commissionsRes.data ?? [];
    const commissions_pending_da = commissions
      .filter((c) => c.status === "pending" || c.status === "validated")
      .reduce((sum, c) => sum + (c.amount_da || 1500), 0);
    const commissions_paid_da = commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + (c.amount_da || 1500), 0);

    return {
      total_leads,
      active_trials,
      conversions,
      conversion_rate,
      commissions_pending_da,
      commissions_paid_da,
    };
  } catch (err) {
    console.error("Erreur getProspectionKPIs :", err);
    return {
      total_leads: 0,
      active_trials: 0,
      conversions: 0,
      conversion_rate: 0,
      commissions_pending_da: 0,
      commissions_paid_da: 0,
    };
  }
}
