import { supabase } from "@/lib/supabase";
import type { Prospector } from "@/lib/types/prospection";

export async function getProspectors(): Promise<Prospector[]> {
  try {
    // 1. Lire les profils avec le rôle 'prospector'
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, wilaya, commune, status, created_at")
      .eq("role", "prospector")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erreur lecture prospectors :", error.message);
      return [];
    }

    if (!profiles || profiles.length === 0) return [];

    const prospectorIds = profiles.map((p) => p.id);

    // 2. Récupérer les statistiques de prospection en parallèle
    const [prospectsRes, commissionsRes] = await Promise.all([
      supabase
        .from("prospects")
        .select("assigned_to, status")
        .in("assigned_to", prospectorIds),
      supabase
        .from("commissions")
        .select("prospector_id, amount, status")
        .in("prospector_id", prospectorIds),
    ]);

    const prospects = prospectsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];

    const result: Prospector[] = profiles.map((p) => {
      const myProspects = prospects.filter((pr) => pr.assigned_to === p.id);
      const myCommissions = commissions.filter((c) => c.prospector_id === p.id);

      const assigned_count = myProspects.length;
      const trial_count = myProspects.filter((pr) => pr.status === "trial").length;
      const converted_count = myProspects.filter((pr) => pr.status === "converted").length;

      const total_commissions_earned = myCommissions
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      const pending_commissions = myCommissions
        .filter((c) => c.status === "pending" || c.status === "approved")
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      return {
        id: p.id,
        full_name: p.full_name || "Prospecteur sans nom",
        phone: p.phone,
        wilaya: p.wilaya || null,
        commune: p.commune || null,
        status: (p.status as "active" | "suspended" | "pending") || "active",
        created_at: p.created_at,
        assigned_count,
        trial_count,
        converted_count,
        total_commissions_earned,
        pending_commissions,
      };
    });

    return result;
  } catch (err) {
    console.error("Erreur getProspectors :", err);
    return [];
  }
}

export async function createProspector(payload: {
  full_name: string;
  email: string;
  phone: string;
  wilaya: string;
  commune?: string;
  notes?: string;
  password?: string;
}): Promise<Prospector> {
  const cleanEmail = payload.email.trim().toLowerCase();
  const cleanPhone = payload.phone.trim();
  const defaultPassword = payload.password || `Pro@${cleanPhone.slice(-4)}${Math.floor(100 + Math.random() * 900)}`;

  // 1. Inscription Auth Supabase avec métadonnées rôle prospector
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password: defaultPassword,
    options: {
      data: {
        full_name: payload.full_name.trim(),
        role: "prospector",
        phone: cleanPhone,
        wilaya: payload.wilaya,
        commune: payload.commune?.trim() || null,
      },
    },
  });

  if (authError) {
    throw new Error(`Erreur création compte Auth : ${authError.message}`);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Impossible de récupérer l'identifiant du nouvel utilisateur.");
  }

  // 2. Insertion ou mise à jour directe dans la table profiles
  const { data: profile, error: profError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        full_name: payload.full_name.trim(),
        role: "prospector",
        phone: cleanPhone,
        wilaya: payload.wilaya,
        commune: payload.commune?.trim() || null,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (profError) {
    throw new Error(`Erreur création profil : ${profError.message}`);
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: cleanEmail,
    phone: profile.phone,
    wilaya: profile.wilaya,
    commune: profile.commune,
    status: profile.status,
    created_at: profile.created_at,
    assigned_count: 0,
    trial_count: 0,
    converted_count: 0,
    total_commissions_earned: 0,
    pending_commissions: 0,
  };
}

export async function updateProspectorStatus(
  id: string,
  status: "active" | "suspended"
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return true;
}

