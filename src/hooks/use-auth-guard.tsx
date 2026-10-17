/**
 * use-auth-guard.tsx
 *
 * Hook partagé qui :
 *  - Vérifie la session Supabase au montage
 *  - Redirige vers "/" si pas connecté
 *  - Redirige vers la bonne route si le rôle ne correspond pas
 *  - Retourne { user, profile, loading }
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export interface AuthProfile {
  id: string;
  full_name: string;
  role: "admin" | "merchant" | "customer";
  initials: string;
  username: string;
}

type RequiredRole = "admin" | "merchant" | "customer" | "any";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  merchant: "/business",
  customer: "/customer",
};

export function useAuthGuard(requiredRole: RequiredRole = "any") {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate({ to: "/" });
        return;
      }

      const userId = session.user.id;

      // Charger le profil
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .single();

      if (!prof) {
        // Profil absent → déconnexion et retour à l'accueil
        await supabase.auth.signOut();
        navigate({ to: "/" });
        return;
      }

      const role = prof.role as AuthProfile["role"];

      // Vérifier le rôle requis
      if (requiredRole !== "any" && role !== requiredRole) {
        navigate({ to: ROLE_HOME[role] ?? "/" });
        return;
      }

      // Extraire le username depuis l'email synthétique (ex: moncommerce@m3ak.app)
      const email = session.user.email ?? "";
      const username = email.endsWith("@m3ak.app")
        ? email.replace("@m3ak.app", "")
        : (email.split("@")[0] ?? email);

      const parts = prof.full_name.trim().split(" ");
      const initials = parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

      if (mounted) {
        setProfile({ id: prof.id, full_name: prof.full_name, role, initials, username });
        setLoading(false);
      }
    }

    check();

    // Écouter les changements de session (logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate({ to: "/" });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profile, loading };
}
