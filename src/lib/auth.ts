/**
 * auth.ts — Gestion de la session Supabase
 *
 * Fournit des hooks et helpers pour lire l'utilisateur connecté,
 * son profil (rôle) et son commerce (si merchant).
 */

import { useEffect, useState } from "react";
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

  useEffect(() => {
    // Charger la session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setMerchant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    setLoading(true);
    try {
      // Charger le profil
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileData) {
        setProfile(profileData as Profile);

        // Si c'est un commerçant, charger son commerce
        if (profileData.role === "merchant") {
          const { data: merchantData } = await supabase
            .from("merchants")
            .select("*")
            .eq("owner_id", userId)
            .single();
          setMerchant(merchantData as Merchant | null);
        } else {
          setMerchant(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }

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

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
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
