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

    // 1. Tenter la récupération des statistiques via RPC rapide (sans limite de pagination PostgREST)
    let statsMap: Record<string, { assigned: number; trials: number; conversions: number }> = {};
    let usedRpc = false;

    try {
      const { data: rpcStats, error: rpcErr } = await supabase.rpc("get_prospector_stats");
      if (!rpcErr && Array.isArray(rpcStats) && rpcStats.length > 0) {
        for (const st of rpcStats) {
          statsMap[st.prospector_id] = {
            assigned: Number(st.assigned_count) || 0,
            trials: Number(st.active_trials_count) || 0,
            conversions: Number(st.conversions_count) || 0,
          };
        }
        usedRpc = true;
      }
    } catch {
      // Ignorer si fonction non encore déployée
    }

    // 2. Si pas de RPC disponible, exécuter des requêtes exactes (COUNT SQL sans limite de 1000 lignes)
    if (!usedRpc) {
      await Promise.all(
        profiles.map(async (p) => {
          const [assignedRes, trialsRes, convRes] = await Promise.all([
            supabase.from("prospects").select("*", { count: "exact", head: true }).eq("assigned_to", p.id),
            supabase.from("prospects").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).eq("status", "trial"),
            supabase.from("prospects").select("*", { count: "exact", head: true }).eq("assigned_to", p.id).or("finale.eq.paid,status.eq.converted"),
          ]);
          statsMap[p.id] = {
            assigned: assignedRes.count || 0,
            trials: trialsRes.count || 0,
            conversions: convRes.count || 0,
          };
        })
      );
    }

    // 3. Récupérer les commissions
    const { data: commissionsData } = await supabase
      .from("commissions")
      .select("prospector_id, amount_da, status")
      .in("prospector_id", prospectorIds);

    const commissions = commissionsData ?? [];

    const result: Prospector[] = profiles.map((p) => {
      const stats = statsMap[p.id] || { assigned: 0, trials: 0, conversions: 0 };
      const myCommissions = commissions.filter((c) => c.prospector_id === p.id);
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
        assigned_count: stats.assigned,
        active_trials_count: stats.trials,
        conversions_count: stats.conversions,
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
    let { data: rpcRes, error: rpcError } = await supabase.rpc("admin_create_prospector", {
      p_username: username,
      p_password: payload.password,
      p_full_name: payload.full_name.trim(),
      p_phone: payload.phone.trim(),
      p_wilaya: payload.wilaya,
      p_commune: payload.commune?.trim() || null,
      p_notes: payload.notes?.trim() || null,
    });

    // Si le token JWT est expiré, tenter un rafraîchissement automatique de la session et réessayer
    if (rpcError && (rpcError.message?.toLowerCase().includes("jwt") || rpcError.code === "PGRST301")) {
      console.warn("[admin_create_prospector] JWT expiré, rafraîchissement de la session...");
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          const retry = await supabase.rpc("admin_create_prospector", {
            p_username: username,
            p_password: payload.password,
            p_full_name: payload.full_name.trim(),
            p_phone: payload.phone.trim(),
            p_wilaya: payload.wilaya,
            p_commune: payload.commune?.trim() || null,
            p_notes: payload.notes?.trim() || null,
          });
          rpcRes = retry.data;
          rpcError = retry.error;
        }
      } catch (refreshErr) {
        console.error("[admin_create_prospector] Échec du rafraîchissement de la session:", refreshErr);
      }
    }

    if (rpcError) {
      console.error("[admin_create_prospector] Erreur RPC:", rpcError);
      if (rpcError.message?.toLowerCase().includes("jwt expired")) {
        return {
          success: false,
          error: "Votre session administrateur a expiré. Veuillez vous reconnecter pour valider cette action.",
        };
      }
      if (
        rpcError.message?.toLowerCase().includes("function") &&
        (rpcError.message?.toLowerCase().includes("does not exist") || rpcError.message?.toLowerCase().includes("not found"))
      ) {
        return {
          success: false,
          error: `La fonction SQL "admin_create_prospector" n'est pas installée dans Supabase. Veuillez exécuter le script SQL fourni dans le SQL Editor.`,
        };
      }
      return { 
        success: false, 
        error: `Erreur lors de la création du prospecteur : ${rpcError.message}` 
      };
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

export async function deleteProspector(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Tenter la suppression via RPC admin sécurisée
    let { error: rpcError } = await supabase.rpc("admin_delete_prospector", {
      p_user_id: id,
    });

    if (rpcError && (rpcError.message?.toLowerCase().includes("jwt") || rpcError.code === "PGRST301")) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          const retry = await supabase.rpc("admin_delete_prospector", {
            p_user_id: id,
          });
          rpcError = retry.error;
        }
      } catch (_) {}
    }

    if (rpcError) {
      console.warn("[deleteProspector] Fallback direct deletion:", rpcError.message);
      // Désassigner les prospects d'abord
      await supabase
        .from("prospects")
        .update({ assigned_to: null, assigned_at: null })
        .eq("assigned_to", id);

      // Nettoyer les assignations et activités
      try {
        await supabase
          .from("prospect_assignments")
          .delete()
          .eq("prospector_id", id);
      } catch (_) {}

      try {
        await supabase
          .from("prospect_activities")
          .delete()
          .eq("user_id", id);
      } catch (_) {}

      // Supprimer le profil
      const { error: profError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", id);

      if (profError) throw new Error(profError.message);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur lors de la suppression." };
  }
}

export async function resetProspectorPassword(
  username: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanUser = cleanUsername(username);

    let { error: rpcError } = await supabase.rpc("admin_reset_prospector_password", {
      p_username: cleanUser,
      p_new_password: newPassword,
    });

    if (rpcError && (rpcError.message?.toLowerCase().includes("jwt") || rpcError.code === "PGRST301")) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session) {
          const retry = await supabase.rpc("admin_reset_prospector_password", {
            p_username: cleanUser,
            p_new_password: newPassword,
          });
          rpcError = retry.error;
        }
      } catch (_) {}
    }

    if (rpcError) {
      console.error("[admin_reset_prospector_password] Erreur RPC:", rpcError);
      return { success: false, error: rpcError.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur réinitialisation" };
  }
}
