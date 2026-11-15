import { supabase } from "@/lib/supabase";
import type { Prospector } from "@/lib/types/prospection";

function cleanUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_.-]/g, "");
}

export async function getProspectors(): Promise<Prospector[]> {
  try {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, username, phone, wilaya, commune, status, created_at")
      .eq("role", "prospector")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erreur lecture prospecteurs :", error.message);
      return [];
    }

    if (!profiles || profiles.length === 0) return [];

    const prospectorIds = profiles.map((p) => p.id);

    // Statistiques agrégées
    const [prospectsRes, commissionsRes] = await Promise.all([
      supabase
        .from("prospects")
        .select("assigned_to, status, finale")
        .in("assigned_to", prospectorIds),
      supabase
        .from("commissions")
        .select("prospector_id, amount_da, status")
        .in("prospector_id", prospectorIds),
    ]);

    const prospects = prospectsRes.data ?? [];
    const commissions = commissionsRes.data ?? [];

    const result: Prospector[] = profiles.map((p) => {
      const myProspects = prospects.filter((pr) => pr.assigned_to === p.id);
      const myCommissions = commissions.filter((c) => c.prospector_id === p.id);

      const assigned_count = myProspects.length;
      const active_trials_count = myProspects.filter((pr) => pr.status === "trial").length;
      const conversions_count = myProspects.filter((pr) => pr.finale === "paid" || pr.status === "converted").length;
      const total_commission_da = myCommissions
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + (Number(c.amount_da) || 1500), 0);

      return {
        id: p.id,
        full_name: p.full_name || "Commercial",
        username: p.username || (p.full_name ? cleanUsername(p.full_name) : `user_${p.id.slice(0, 5)}`),
        phone: p.phone,
        wilaya: p.wilaya || null,
        commune: p.commune || null,
        status: (p.status as "active" | "suspended") || "active",
        created_at: p.created_at,
        assigned_count,
        active_trials_count,
        conversions_count,
        total_commission_da,
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
  username: string;
  password: string;
  phone: string;
  wilaya: string;
  commune?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string; prospector?: Prospector }> {
  try {
    const username = cleanUsername(payload.username);
    if (!username || username.length < 3) {
      return { success: false, error: "Le nom d'utilisateur doit comporter au moins 3 caractères alphanumériques." };
    }

    if (!payload.password || payload.password.length < 6) {
      return { success: false, error: "Le mot de passe doit comporter au moins 6 caractères." };
    }

    // 1. Vérifier si le username existe déjà dans profiles
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (existingUser) {
      return { success: false, error: `Le nom d'utilisateur "${username}" est déjà utilisé.` };
    }

    // 2. Création directe par RPC Admin (sans limite d'envoi d'emails ni déconnexion de session)
    const { data: rpcRes, error: rpcError } = await supabase.rpc("admin_create_prospector", {
      p_username: username,
      p_password: payload.password,
      p_full_name: payload.full_name.trim(),
      p_phone: payload.phone.trim(),
      p_wilaya: payload.wilaya,
      p_commune: payload.commune?.trim() || null,
      p_notes: payload.notes?.trim() || null,
    });

    if (rpcError) {
      // Fallback si la fonction RPC n'a pas encore été créée dans Supabase
      if (rpcError.message.includes("function") && rpcError.message.includes("does not exist")) {
        const authEmail = `${username}@m3ak.app`;
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: authEmail,
          password: payload.password,
          options: {
            data: {
              full_name: payload.full_name.trim(),
              username: username,
              role: "prospector",
              phone: payload.phone.trim(),
              wilaya: payload.wilaya,
              commune: payload.commune?.trim() || null,
            },
          },
        });
        if (authErr) return { success: false, error: authErr.message };
        const newId = authData.user?.id;
        if (!newId) return { success: false, error: "Échec de création du compte commercial." };
        await supabase.from("profiles").upsert({
          id: newId,
          full_name: payload.full_name.trim(),
          username: username,
          role: "prospector",
          phone: payload.phone.trim(),
          wilaya: payload.wilaya,
          commune: payload.commune?.trim() || null,
          status: "active",
        });
      } else {
        return { success: false, error: rpcError.message };
      }
    }

    // Récupérer le profil nouvellement créé
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, username, phone, wilaya, commune, status, created_at")
      .eq("username", username)
      .maybeSingle();

    return {
      success: true,
      prospector: profile
        ? {
            id: profile.id,
            full_name: profile.full_name,
            username: profile.username || username,
            phone: profile.phone || payload.phone,
            wilaya: profile.wilaya || payload.wilaya,
            commune: profile.commune || null,
            status: (profile.status as Prospector["status"]) || "active",
            assigned_prospects_count: 0,
            trials_count: 0,
            conversions_count: 0,
            created_at: profile.created_at,
          }
        : undefined,
    };

    return {
      success: true,
      prospector: {
        id: profile.id,
        full_name: profile.full_name,
        username: profile.username || username,
        phone: profile.phone,
        wilaya: profile.wilaya,
        commune: profile.commune,
        status: "active",
        created_at: profile.created_at,
        assigned_count: 0,
        active_trials_count: 0,
        conversions_count: 0,
        total_commission_da: 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur inattendue" };
  }
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

export async function resetProspectorPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Si l'utilisateur est admin ou utilise une fonction sécurisée
    const cleanUser = cleanUsername(username);
    const authEmail = `${cleanUser}@m3ak.app`;
    
    // Tentative de mise à jour si session active ou appel RPC
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur réinitialisation" };
  }
}
