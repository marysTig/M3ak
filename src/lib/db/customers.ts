/**
 * db/customers.ts — Gestion des clients (vue commerçant et admin)
 */
import { supabase } from "../supabase";

export interface CustomerWithCard {
  customer: {
    id: string;
    full_name: string;
    email: string;
  };
  card: {
    id: string;
    qr_token: string;
    points: number;
    total_earned: number;
    status: "active" | "inactive" | "suspended";
    created_at: string;
    updated_at: string;
  };
  status: "active" | "inactive" | "new";
  joinedFormatted: string;
}

/** Tous les clients d'un commerce avec leurs cartes */
export async function getMerchantCustomers(merchantId: string): Promise<CustomerWithCard[]> {
  const { data, error } = await supabase
    .from("loyalty_cards")
    .select(`
      id, qr_token, points, total_earned, status, created_at, updated_at,
      profiles!loyalty_cards_customer_id_fkey (
        id, full_name
      )
    `)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    // Calculer le statut basé sur la date de mise à jour
    const daysSinceActivity =
      (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24);

    let status: "active" | "inactive" | "new" = "new";
    if (row.total_earned === 0) {
      status = "new";
    } else if (daysSinceActivity > 90) {
      status = "inactive";
    } else {
      status = "active";
    }

    return {
      customer: {
        id: profile?.id ?? "",
        full_name: profile?.full_name ?? "Client",
        email: "",  // email non stocké dans profiles (via auth.users)
      },
      card: {
        id: row.id,
        qr_token: row.qr_token,
        points: row.points,
        total_earned: row.total_earned,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      status,
      joinedFormatted: new Date(row.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
  });
}

/** Crée un client + carte via invitation (email) */
export async function inviteCustomer(params: {
  email: string;
  name: string;
  merchantId: string;
  storeId?: string;
  themeId?: string;
}) {
  // Étape 1 : Créer le compte via OTP / magic link
  // Dans Supabase, on utilise signUp avec email pour inviter
  // Le mot de passe temporaire sera changé par l'utilisateur
  const tempPassword = crypto.randomUUID().slice(0, 12) + "A1!";

  const { data: authData, error: authError } = await supabase.auth.admin
    ? // Si admin SDK dispo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.auth as any).admin.createUser({
        email: params.email,
        password: tempPassword,
        user_metadata: { full_name: params.name, role: "customer" },
        email_confirm: true,
      })
    : await supabase.auth.signUp({
        email: params.email,
        password: tempPassword,
        options: {
          data: { full_name: params.name, role: "customer" },
        },
      });

  if (authError) throw new Error(authError.message);

  const userId = (authData as { user?: { id: string } })?.user?.id;
  if (!userId) throw new Error("Impossible de créer l'utilisateur.");

  // Étape 2 : Créer la carte (le trigger a déjà créé le profil)
  // Attendre un peu que le trigger s'exécute
  await new Promise((r) => setTimeout(r, 500));

  const { data: card, error: cardError } = await supabase
    .from("loyalty_cards")
    .upsert(
      {
        customer_id: userId,
        merchant_id: params.merchantId,
        store_id: params.storeId ?? null,
      },
      { onConflict: "customer_id,merchant_id" }
    )
    .select()
    .single();

  if (cardError) throw new Error(cardError.message);

  return { userId, card };
}

/** Tous les clients (vue admin) */
export async function getAllCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id, full_name, role, created_at,
      loyalty_cards!loyalty_cards_customer_id_fkey (
        id, points, merchant_id
      )
    `)
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const cards = Array.isArray(p.loyalty_cards) ? p.loyalty_cards : [];
    const totalPoints = cards.reduce((s: number, c: { points: number }) => s + c.points, 0);
    return {
      id: p.id,
      name: p.full_name,
      memberships: cards.length,
      totalPoints,
      joined: new Date(p.created_at).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
  });
}
