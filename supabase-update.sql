-- =============================================================================
-- M3ak — Mise à jour SQL (delta uniquement)
-- =============================================================================
-- Ce fichier contient UNIQUEMENT les ajustements récents.
-- À exécuter sur une base déjà initialisée avec supabase-schema.sql.
-- Idempotent : peut être ré-exécuté sans erreur.
-- =============================================================================


-- ─── 1. Supprimer les anciens triggers (évite l'erreur 42710) ─────────────────

drop trigger if exists on_auth_user_created       on auth.users;
drop trigger if exists trg_profiles_updated_at    on public.profiles;
drop trigger if exists trg_merchants_updated_at   on public.merchants;
drop trigger if exists trg_lp_updated_at          on public.loyalty_programs;
drop trigger if exists trg_rewards_updated_at     on public.rewards;
drop trigger if exists trg_cards_updated_at       on public.loyalty_cards;


-- ─── 2. Recréer set_updated_at (idempotent) ──────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_merchants_updated_at
  before update on public.merchants
  for each row execute function public.set_updated_at();

create trigger trg_lp_updated_at
  before update on public.loyalty_programs
  for each row execute function public.set_updated_at();

create trigger trg_rewards_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

create trigger trg_cards_updated_at
  before update on public.loyalty_cards
  for each row execute function public.set_updated_at();


-- ─── 3. Trigger handle_new_user amélioré ─────────────────────────────────────
-- Extraction du username depuis l'email synthétique (username@m3ak.app)
-- Gestion du conflit (ON CONFLICT DO UPDATE) pour l'idempotence

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_role      text;
  v_username  text;
begin
  -- Username : partie avant le @
  v_username := split_part(new.email, '@', 1);

  -- Nom complet : metadata > username > email
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    v_username,
    new.email,
    'Utilisateur'
  );

  -- Rôle : metadata > customer par défaut
  v_role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'customer'
  );

  insert into public.profiles (id, full_name, role)
  values (new.id, v_full_name, v_role)
  on conflict (id) do update
    set full_name  = excluded.full_name,
        role       = excluded.role,
        updated_at = now();

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. Table platform_settings (paramètres admin) ───────────────────────────

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

-- Tout le monde peut lire
do $$ begin
  create policy "settings_read_all" on public.platform_settings for select using (true);
exception when duplicate_object then null; end $$;

-- Seuls les admins peuvent écrire
do $$ begin
  create policy "settings_admin_write" on public.platform_settings for all
    using ((select role from public.profiles where id = auth.uid()) = 'admin');
exception when duplicate_object then null; end $$;


-- ─── 5. Données par défaut des paramètres ────────────────────────────────────

insert into public.platform_settings (key, value)
values
  ('platform_name',  'M3ak Loyalty'),
  ('support_email',  'support@m3ak.app'),
  ('auto_approve',   'false'),
  ('weekly_digest',  'true')
on conflict (key) do nothing;


-- =============================================================================
-- FIN DE LA MISE À JOUR
-- =============================================================================
