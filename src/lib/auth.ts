/**
 * auth.ts — Gestion de la session Supabase
 *
 * Fournit des hooks et helpers pour lire l'utilisateur connecté,
 * son profil (rôle) et son commerce (si merchant).
 *
 * IMPORTANT : loadProfile() ne doit jamais être appelé directement
 * dans le callback onAuthStateChange (risque de deadlock Supabase).
 * On utilise setTimeout(..., 0) pour sortir du contexte du callback.
 */

import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "merchant" | "customer";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string;
  owner_id: string;
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  slug: string | null;
  plan: "starter" | "growth" | "pro";
  status: "active" | "pending" | "suspended";
  subscription_expires_at: string | null;
  is_trial?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  merchant: Merchant | null;
  loading: boolean;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  // Évite les appels en double si plusieurs changements d'état arrivent rapidement
  const loadingRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile(userId: string) {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (mounted) setLoading(true);
      try {
        const { data: profileData, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        if (profErr) {
          console.warn("[useAuth] Erreur chargement profil:", profErr.message);
          return;
        }

        if (profileData && mounted) {
          setProfile(profileData as Profile);

          if (profileData.role === "merchant") {
            const { data: merchantData } = await supabase
              .from("merchants")
              .select("*")
              .eq("owner_id", userId)
              .single();
            if (mounted) setMerchant(merchantData as Merchant | null);
          } else {
            if (mounted) setMerchant(null);
          }
        }
      } finally {
        loadingRef.current = false;
        if (mounted) setLoading(false);
      }
    }

    // 1. Charger la session initiale depuis le storage local
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Écouter les changements d'auth (refresh, logout, signin)
    //    NE PAS appeler await supabase.* directement ici → deadlock possible.
    //    On utilise setTimeout pour sortir du contexte du callback interne.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Sortir du contexte synchrone du callback pour éviter le deadlock
        setTimeout(() => {
          if (mounted) loadProfile(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setMerchant(null);
        setLoading(false);
        loadingRef.current = false;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, profile, merchant, loading };
}

// ─── Helpers d'auth ───────────────────────────────────────────────────────────

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  role: UserRole = "customer",
) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
  });
}

/**
 * Déconnexion sécurisée :
 * Évite l'erreur 403 Forbidden lors de la déconnexion avec un token expiré.
 * Si le token est déjà expiré ou invalide, effectue directement une déconnexion
 * locale sans appel réseau inutile. En cas d'échec du logout global, bascule
 * sur le scope local et nettoie le stockage.
 */
export async function safeSignOut() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const isExpired = session?.expires_at ? session.expires_at * 1000 <= Date.now() : true;

    if (isExpired || !session) {
      // Token déjà expiré ou session absente : déconnexion locale immédiate sans requête réseau 403
      await supabase.auth.signOut({ scope: "local" });
    } else {
      // Token encore valide : tentative de déconnexion globale
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        // Repli local si l'appel serveur est rejeté (ex: 403/401)
        await supabase.auth.signOut({ scope: "local" });
      }
    }
  } catch (err) {
    console.warn("[safeSignOut] Repli sur déconnexion locale:", err);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignorer
    }
  } finally {
    if (typeof window !== "undefined") {
      try {
        const storageKey = (supabase.auth as unknown as { storageKey?: string }).storageKey;
        if (storageKey) localStorage.removeItem(storageKey);
      } catch {
        // Ignorer
      }
    }
  }
}

export async function signOut() {
  return safeSignOut();
}

/**
 * Récupère une session valide en utilisant le mécanisme natif de Supabase.
 * Si le token est sur le point d'expirer (< 60s) ou expiré, rafraîchit la session.
 * Si le refresh token est également invalide/révoqué, déconnecte proprement.
 */
export async function getValidSession(): Promise<Session | null> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    return null;
  }

  const isExpiringSoon = session.expires_at
    ? session.expires_at * 1000 - Date.now() < 60000
    : false;

  if (isExpiringSoon) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session) {
      console.warn("[getValidSession] Session irrécupérable, déconnexion locale:", refreshError?.message);
      await safeSignOut();
      return null;
    }
    return refreshed.session;
  }

  return session;
}

export async function getCurrentSession() {
  return getValidSession();
}

// ─── Récupérer le profil d'un utilisateur ────────────────────────────────────

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data as Profile | null;
}

export async function updateProfile(userId: string, updates: Partial<Pick<Profile, "full_name">>) {
  return supabase.from("profiles").update(updates).eq("id", userId);
}
