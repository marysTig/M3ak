import { supabase } from "@/lib/supabase";
import type { CommercialFollowup, FollowupPriority, FollowupStatus } from "@/lib/types/prospection";

export async function getFollowups(filters?: {
  status?: string;
  priority?: string;
  prospectorId?: string;
}): Promise<CommercialFollowup[]> {
  try {
    let q = supabase
      .from("commercial_followups")
      .select(`
        *,
        prospects:prospect_id(business_name, phone, wilaya),
        prospector:profiles!commercial_followups_prospector_id_fkey(full_name)
      `)
      .order("due_date", { ascending: true });

    if (filters?.status && filters.status !== "all") {
      q = q.eq("status", filters.status);
    }
    if (filters?.priority && filters.priority !== "all") {
      q = q.eq("priority", filters.priority);
    }
    if (filters?.prospectorId && filters.prospectorId !== "all") {
      q = q.eq("prospector_id", filters.prospectorId);
    }

    const { data, error } = await q;
    if (error) {
      console.warn("Erreur getFollowups :", error.message);
      return [];
    }

    return (data ?? []).map((f: any) => ({
      id: f.id,
      prospect_id: f.prospect_id,
      prospect_name: f.prospects?.business_name || "Prospect inconnu",
      prospect_phone: f.prospects?.phone,
      prospect_wilaya: f.prospects?.wilaya,
      prospector_id: f.prospector_id,
      prospector_name: f.prospector?.full_name || "Non assigné",
      due_date: f.due_date,
      priority: f.priority as FollowupPriority,
      status: f.status as FollowupStatus,
      notes: f.notes,
      completed_at: f.completed_at,
      created_at: f.created_at,
    }));
  } catch (err) {
    console.error("Erreur getFollowups :", err);
    return [];
  }
}

export async function createFollowup(payload: {
  prospect_id: string;
  due_date: string;
  priority?: FollowupPriority;
  notes?: string;
  prospector_id?: string;
}): Promise<CommercialFollowup> {
  const { data, error } = await supabase
    .from("commercial_followups")
    .insert({
      prospect_id: payload.prospect_id,
      due_date: payload.due_date,
      priority: payload.priority || "medium",
      notes: payload.notes || null,
      prospector_id: payload.prospector_id || null,
      status: "pending",
    })
    .select(`
      *,
      prospects:prospect_id(business_name, phone, wilaya),
      prospector:profiles!commercial_followups_prospector_id_fkey(full_name)
    `)
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    prospect_id: data.prospect_id,
    prospect_name: data.prospects?.business_name,
    prospect_phone: data.prospects?.phone,
    prospect_wilaya: data.prospects?.wilaya,
    prospector_id: data.prospector_id,
    prospector_name: data.prospector?.full_name,
    due_date: data.due_date,
    priority: data.priority,
    status: data.status,
    notes: data.notes,
    completed_at: data.completed_at,
    created_at: data.created_at,
  };
}

export async function completeFollowup(id: string, notes?: string): Promise<boolean> {
  const updates: Record<string, any> = {
    status: "completed",
    completed_at: new Date().toISOString(),
  };
  if (notes) updates.notes = notes;

  const { error } = await supabase
    .from("commercial_followups")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
  return true;
}

export async function rescheduleFollowup(id: string, newDate: string, notes?: string): Promise<boolean> {
  const updates: Record<string, any> = {
    due_date: newDate,
    status: "rescheduled",
  };
  if (notes) updates.notes = notes;

  const { error } = await supabase
    .from("commercial_followups")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
  return true;
}

export async function deleteFollowup(id: string): Promise<boolean> {
  const { error } = await supabase.from("commercial_followups").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

