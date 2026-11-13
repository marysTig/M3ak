/**
 * use-auth-guard.tsx
 *
 * Hook partagé qui :
 *  - Vérifie et rafraîchit automatiquement la session Supabase au montage
 *  - Gère nativement l'expiration des tokens (PGRST303) sans boucle infinie
 *  - Redirige vers "/" avec message clair si le refresh token est expiré/révoqué
 *  - Redirige vers la bonne route si le rôle ne correspond pas
 *  - Retourne { profile, loading }
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { safeSignOut, getValidSession } from "@/lib/auth";
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
      // 1. Obtenir une session valide (rafraîchie automatiquement si proche de l'expiration)
      const session = await getValidSession();

      if (!session?.user) {
        if (mounted) {
          setLoading(false);
          navigate({ to: "/" });
        }
        return;
      }

      const userId = session.user.id;

      // 2. Charger le profil avec gestion de l'expiration JWT (PGRST303)
      let { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", userId)
        .maybeSingle();

      // En cas de token expiré reçu par PostgREST (PGRST303)
      if (profErr && (profErr.code === "PGRST303" || profErr.message?.includes("JWT expired"))) {
        console.warn("[useAuthGuard] JWT expiré détecté sur profiles, rafraîchissement natif...");
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();

        if (refreshErr || !refreshed.session) {
          console.error("[useAuthGuard] Échec du rafraîchissement natif:", refreshErr?.message);
          await safeSignOut();
          if (mounted) {
            setLoading(false);
            toast.error("Session expirée", {
              description: "Veuillez vous reconnecter pour continuer.",
            });
            navigate({ to: "/" });
          }
          return;
        }

        // Réessayer la lecture avec le token fraîchement renouvelé
        const retry = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", userId)
          .maybeSingle();

        prof = retry.data;
      }

      // Repli sur les métadonnées de l'utilisateur si la table profiles n'a pas encore la ligne
      if (!prof && session.user.user_metadata?.['role']) {
        prof = {
          id: userId,
          full_name: (session.user.user_metadata['full_name'] as string) || "Utilisateur",
          role: session.user.user_metadata['role'] as "admin" | "merchant" | "customer",
        };
      }

      if (!prof) {
        // Profil inexistant et irrécupérable → déconnexion locale sécurisée
        await safeSignOut();
        if (mounted) {
          setLoading(false);
          toast.error("Session invalide", {
            description: "Votre compte est introuvable. Veuillez vous reconnecter.",
          });
          navigate({ to: "/" });
        }
        return;
      }

      const role = prof.role as AuthProfile["role"];

      // Vérifier le rôle requis
      if (requiredRole !== "any" && role !== requiredRole) {
        if (mounted) {
          setLoading(false);
          navigate({ to: ROLE_HOME[role] ?? "/" });
        }
        return;
      }

      // Extraire le username depuis l'email synthétique (ex: moncommerce@m3ak.app)
      const email = session.user.email ?? "";
      const username = email.endsWith("@m3ak.app")
        ? email.replace("@m3ak.app", "")
        : (email.split("@")[0] ?? email);

      const parts = prof.full_name.trim().split(" ");
      const initials = parts.map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "U";

      if (mounted) {
        setProfile({ id: prof.id, full_name: prof.full_name, role, initials, username });
        setLoading(false);
      }
    }

    check();

    // Écouter les changements d'auth (logout, session révoquée)
    // SANS bloquer ni effectuer d'appels asynchrones Supabase directement dans le callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
          navigate({ to: "/" });
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profile, loading };
}
