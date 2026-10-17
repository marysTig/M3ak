/**
 * supabase.ts
 *
 * Client Supabase partagé pour toute l'application.
 * Utilise les variables d'environnement Vite (VITE_SUPABASE_*).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
const supabaseKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Types de base de données ────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string;
          merchant_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          merchant_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          merchant_id?: string;
          created_at?: string;
        };
      };
      loyalty_cards: {
        Row: {
          id: string;
          customer_id: string;
          merchant_id: string;
          store_id: string;
          qr_token: string;
          points: number;
          total_earned: number;
          status: "active" | "inactive" | "suspended";
          theme_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          merchant_id: string;
          store_id: string;
          qr_token: string;
          points?: number;
          total_earned?: number;
          status?: "active" | "inactive" | "suspended";
          theme_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          merchant_id?: string;
          store_id?: string;
          qr_token?: string;
          points?: number;
          total_earned?: number;
          status?: "active" | "inactive" | "suspended";
          theme_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          card_id: string;
          customer_id: string;
          merchant_id: string;
          store_id: string;
          points_added: number;
          previous_balance: number;
          new_balance: number;
          description: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          customer_id: string;
          merchant_id: string;
          store_id: string;
          points_added: number;
          previous_balance: number;
          new_balance: number;
          description?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          card_id?: string;
          customer_id?: string;
          merchant_id?: string;
          store_id?: string;
          points_added?: number;
          previous_balance?: number;
          new_balance?: number;
          description?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      merchant_themes: {
        Row: {
          merchant_id: string;
          theme_id: string;
          updated_at: string;
        };
        Insert: {
          merchant_id: string;
          theme_id: string;
          updated_at?: string;
        };
        Update: {
          merchant_id?: string;
          theme_id?: string;
          updated_at?: string;
        };
      };
    };
  };
};
