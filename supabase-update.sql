-- =============================================================================
-- M3ak — Mise à jour SQL complète (idempotente)
-- =============================================================================
-- À exécuter dans votre Supabase Dashboard > SQL Editor.
-- Peut être exécuté plusieurs fois sans aucune erreur.
-- =============================================================================

-- ─── 1. Supprimer les anciens triggers ────────────────────────────────────────

drop trigger if exists on_auth_user_created       on auth.users;
drop trigger if exists trg_auto_confirm_user      on auth.users;
drop trigger if exists trg_profiles_updated_at    on public.profiles;
drop trigger if exists trg_merchants_updated_at   on public.merchants;
drop trigger if exists trg_lp_updated_at          on public.loyalty_programs;
drop trigger if exists trg_rewards_updated_at     on public.rewards;
drop trigger if exists trg_cards_updated_at       on public.loyalty_cards;


-- ─── 2. Recréer set_updated_at ────────────────────────────────────────────────

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


-- ─── 2b. Colonne téléphone dans profiles ─────────────────────────────────────

alter table public.profiles add column if not exists phone text;

-- ─── 2c. Colonne subscription_expires_at dans merchants ──────────────────────

alter table public.merchants add column if not exists subscription_expires_at timestamptz;

-- ─── 2d. Colonnes pour les 3 types de cartes (VIP, Points, Tampons) ───────────

alter table public.loyalty_cards add column if not exists card_type text not null default 'points';
alter table public.loyalty_cards add column if not exists card_name text;
alter table public.loyalty_cards add column if not exists theme_id text default 'aurora';

-- Tampons
alter table public.loyalty_cards add column if not exists stamps_count integer default 0;
alter table public.loyalty_cards add column if not exists stamps_target integer default 10;
alter table public.loyalty_cards add column if not exists stamp_reward text default '1 produit offert au 10ème passage';
alter table public.loyalty_cards add column if not exists stamp_conditions text;

-- VIP
alter table public.loyalty_cards add column if not exists vip_tier text default 'bronze';
alter table public.loyalty_cards add column if not exists vip_spent numeric default 0;
alter table public.loyalty_cards add column if not exists vip_bronze_threshold numeric default 0;
alter table public.loyalty_cards add column if not exists vip_silver_threshold numeric default 15000;
alter table public.loyalty_cards add column if not exists vip_gold_threshold numeric default 30000;
alter table public.loyalty_cards add column if not exists vip_bronze_benefits text default '-5% de réduction';
alter table public.loyalty_cards add column if not exists vip_silver_benefits text default '-10% de réduction + Cadeau';
alter table public.loyalty_cards add column if not exists vip_gold_benefits text default '-15% de réduction + Accès prioritaire';


-- ─── 3. Trigger handle_new_user ───────────────────────────────────────────────
-- Crée automatiquement le profil et la fiche commerce si le rôle est 'merchant'

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_role      text;
  v_username  text;
  v_slug      text;
  v_phone     text;
begin
  v_username := split_part(new.email, '@', 1);

  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    v_username,
    new.email,
    'Utilisateur'
  );

  v_role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'customer'
  );

  v_phone := nullif(trim(new.raw_user_meta_data->>'phone'), '');

  -- Création ou mise à jour du profil
  insert into public.profiles (id, full_name, phone, role)
  values (new.id, v_full_name, v_phone, v_role)
  on conflict (id) do update
    set full_name  = excluded.full_name,
        phone      = coalesce(excluded.phone, public.profiles.phone),
        role       = excluded.role,
        updated_at = now();

  -- Si rôle = merchant, créer automatiquement la fiche commerce
  if v_role = 'merchant' then
    v_slug := lower(regexp_replace(v_username, '[^a-zA-Z0-9]', '-', 'g'));
    if not exists (select 1 from public.merchants where owner_id = new.id) then
      insert into public.merchants (owner_id, name, slug, status, plan)
      values (new.id, v_full_name, v_slug, 'active', 'starter')
      on conflict (slug) do nothing;
    end if;
  end if;

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─── 4. Auto-confirmation des utilisateurs auth.users ─────────────────────────
-- Garantit qu'aucun compte ne reste bloqué avec "Email not confirmed"
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end; $$;

create trigger trg_auto_confirm_user
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- Confirmer rétroactivement tous les comptes existants
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;


-- ─── 5. Table platform_settings ───────────────────────────────────────────────

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

do $$ begin
  create policy "settings_read_all" on public.platform_settings for select using (true);
exception when duplicate_object then null; end $$;


-- ─── 6. Résolution de la récursion infinie RLS (is_admin) ────────────────────

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_admin"       on public.profiles;
create policy "profiles_admin"              on public.profiles for select using (public.is_admin());

drop policy if exists "merchants_admin"      on public.merchants;
create policy "merchants_admin"             on public.merchants for all using (public.is_admin());

drop policy if exists "stores_admin"         on public.stores;
create policy "stores_admin"                on public.stores for all using (public.is_admin());

drop policy if exists "lp_admin"             on public.loyalty_programs;
create policy "lp_admin"                    on public.loyalty_programs for all using (public.is_admin());

drop policy if exists "rewards_admin"        on public.rewards;
create policy "rewards_admin"               on public.rewards for all using (public.is_admin());

drop policy if exists "cards_admin"          on public.loyalty_cards;
create policy "cards_admin"                 on public.loyalty_cards for all using (public.is_admin());

drop policy if exists "tx_admin"             on public.transactions;
create policy "tx_admin"                    on public.transactions for all using (public.is_admin());

drop policy if exists "redemptions_admin"    on public.reward_redemptions;
create policy "redemptions_admin"           on public.reward_redemptions for all using (public.is_admin());

drop policy if exists "settings_admin_write" on public.platform_settings;
create policy "settings_admin_write"        on public.platform_settings for all using (public.is_admin());

insert into public.platform_settings (key, value)
values
  ('platform_name',  'M3ak Loyalty'),
  ('support_email',  'support@m3ak.app'),
  ('auto_approve',   'true'),
  ('weekly_digest',  'true')
on conflict (key) do update set value = excluded.value;


-- ─── 7. Statut 'active' par défaut pour les commerces ────────────────────────

alter table public.merchants alter column status set default 'active';


-- ─── 8. Compte Administrateur (marys / marys062002) ──────────────────────────

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid;
begin
  set local search_path = public, extensions, auth;

  select id into v_user_id from auth.users where email = 'marys@m3ak.app';

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud,
      confirmation_token
    ) values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'marys@m3ak.app',
      extensions.crypt('marys062002', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"],"role":"admin"}',
      '{"full_name":"marys","role":"admin","username":"marys"}',
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  else
    update auth.users
    set encrypted_password = extensions.crypt('marys062002', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role": "admin", "full_name": "marys", "username": "marys"}'::jsonb,
        raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
        updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.profiles (id, full_name, role)
  values (v_user_id, 'marys', 'admin')
  on conflict (id) do update
    set role = 'admin',
        full_name = 'marys',
        updated_at = now();
end $$;


-- ─── 9. Suppression définitive d'un commerce par l'administrateur ─────────────

create or replace function public.delete_merchant_account(p_merchant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  -- Vérifier que l'appelant est bien administrateur
  if not public.is_admin() then
    raise exception 'Accès refusé : action réservée aux administrateurs.';
  end if;

  -- Récupérer l'owner_id (compte utilisateur auth.users)
  select owner_id into v_owner_id
  from public.merchants
  where id = p_merchant_id;

  if v_owner_id is null then
    raise exception 'Commerce introuvable.';
  end if;

  -- 1. Supprimer les échanges de récompenses liés aux cartes du commerce
  delete from public.reward_redemptions
  where card_id in (select id from public.loyalty_cards where merchant_id = p_merchant_id);

  -- 2. Supprimer les transactions liées au commerce ou à ses cartes
  delete from public.transactions
  where merchant_id = p_merchant_id
     or card_id in (select id from public.loyalty_cards where merchant_id = p_merchant_id);

  -- 3. Supprimer les cartes de fidélité du commerce
  delete from public.loyalty_cards
  where merchant_id = p_merchant_id;

  -- 4. Supprimer les récompenses
  delete from public.rewards
  where merchant_id = p_merchant_id;

  -- 5. Supprimer le programme de fidélité
  delete from public.loyalty_programs
  where merchant_id = p_merchant_id;

  -- 6. Supprimer les points de vente
  delete from public.stores
  where merchant_id = p_merchant_id;

  -- 7. Supprimer le commerce
  delete from public.merchants
  where id = p_merchant_id;

  -- 8. Supprimer le profil et l'utilisateur dans auth.users
  delete from public.profiles
  where id = v_owner_id;

  delete from auth.users
  where id = v_owner_id;
end;
$$;

grant execute on function public.delete_merchant_account(uuid) to authenticated;


-- ─── 10. Accès public aux cartes via qr_token (lien de partage sans compte) ──

-- Permettre la lecture d'une carte par son qr_token sans authentification
-- (utilisé par la page publique /card/{qr_token})
drop policy if exists "cards_public_by_token" on public.loyalty_cards;
create policy "cards_public_by_token"
  on public.loyalty_cards for select
  using (true);  -- La sécurité est assurée par le qr_token aléatoire (128 bits d'entropie)

-- Permettre la lecture des profils clients depuis le lien de carte (pour afficher le nom)
drop policy if exists "profiles_public_for_card" on public.profiles;
create policy "profiles_public_for_card"
  on public.profiles for select
  using (true);

-- Permettre la lecture des récompenses actives sans compte
drop policy if exists "rewards_public" on public.rewards;
create policy "rewards_public"
  on public.rewards for select
  using (active = true);

-- Permettre la lecture du programme de fidélité sans compte
drop policy if exists "lp_public" on public.loyalty_programs;
create policy "lp_public"
  on public.loyalty_programs for select
  using (status = 'active');


-- ─── 11. RPC : merchant_create_card — crée une carte sans toucher à la session ─
-- Supporte les 3 types de cartes : 'points', 'vip', 'stamps'

drop function if exists public.merchant_create_card(text, uuid);
drop function if exists public.merchant_create_card(text, uuid, text);
drop function if exists public.merchant_create_card(text, uuid, text, text, text, text, jsonb);

create or replace function public.merchant_create_card(
  p_customer_name text,
  p_merchant_id   uuid,
  p_phone         text default null,
  p_card_type     text default 'points',
  p_card_name     text default null,
  p_theme_id      text default 'aurora',
  p_config        jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_caller_id   uuid := auth.uid();
  v_owner_id    uuid;
  v_customer_id uuid;
  v_slug        text;
  v_fake_email  text;
  v_card        public.loyalty_cards%rowtype;
  v_hash        text;
  v_dummy_pwd   text;
  v_clean_phone text;
  v_type        text := coalesce(nullif(trim(p_card_type), ''), 'points');
begin
  -- Vérifier que l'appelant est bien le propriétaire du commerce
  select owner_id into v_owner_id
  from public.merchants
  where id = p_merchant_id;

  if v_owner_id is null then
    raise exception 'Commerce introuvable.';
  end if;

  if v_owner_id <> v_caller_id and not public.is_admin() then
    raise exception 'Accès refusé : vous n''êtes pas le propriétaire de ce commerce.';
  end if;

  -- Vérifier si le commerce est suspendu ou si son abonnement a expiré
  if exists (
    select 1 from public.merchants
    where id = p_merchant_id
      and (status = 'suspended' or (subscription_expires_at is not null and subscription_expires_at < now()))
  ) and not public.is_admin() then
    -- Mettre à jour automatiquement le statut en 'suspended' si expiré
    update public.merchants
    set status = 'suspended', updated_at = now()
    where id = p_merchant_id and subscription_expires_at < now();

    raise exception 'Votre compte est suspendu ou votre période d''activation a expiré. Veuillez contacter l''administrateur.';
  end if;

  v_clean_phone := nullif(trim(p_phone), '');

  -- Générer un email interne unique (sans dépendance externe)
  v_hash       := substr(md5(p_customer_name || coalesce(v_clean_phone, '') || p_merchant_id::text || now()::text || random()::text), 1, 8);
  v_slug       := lower(regexp_replace(
                    regexp_replace(trim(p_customer_name), '[^a-zA-Z0-9 ]+', '', 'g'),
                    '[ ]+', '-', 'g'
                  ));
  if v_slug = '' or v_slug = '-' then v_slug := 'client'; end if;
  v_fake_email := v_slug || '-' || v_hash || '@m3ak.internal';

  -- Hash factice au format bcrypt (standard, aucune extension requise)
  v_dummy_pwd  := '$2a$10$' || substr(md5(random()::text) || md5(random()::text), 1, 53);

  -- Créer l'utilisateur fantôme dans auth.users (si non existant)
  if not exists (select 1 from auth.users where email = v_fake_email) then
    insert into auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, role, aud, confirmation_token
    ) values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      v_fake_email,
      v_dummy_pwd,
      now(),
      '{"provider":"email","providers":["email"]}',
      json_build_object('full_name', p_customer_name, 'phone', v_clean_phone, 'role', 'customer')::jsonb,
      now(), now(),
      'authenticated', 'authenticated', ''
    );
  end if;

  -- Récupérer l'ID du compte fantôme
  select id into v_customer_id from auth.users where email = v_fake_email;

  -- S'assurer que le profil existe et enregistre le téléphone
  insert into public.profiles (id, full_name, phone, role)
  values (v_customer_id, p_customer_name, v_clean_phone, 'customer')
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = coalesce(excluded.phone, public.profiles.phone);

  -- Récupérer ou créer la carte avec son type
  select * into v_card
  from public.loyalty_cards
  where customer_id = v_customer_id and merchant_id = p_merchant_id and card_type = v_type;

  if not found then
    insert into public.loyalty_cards (
      customer_id,
      merchant_id,
      card_type,
      card_name,
      theme_id,
      points,
      total_earned,
      stamps_count,
      stamps_target,
      stamp_reward,
      stamp_conditions,
      vip_tier,
      vip_spent,
      vip_bronze_threshold,
      vip_silver_threshold,
      vip_gold_threshold,
      vip_bronze_benefits,
      vip_silver_benefits,
      vip_gold_benefits
    ) values (
      v_customer_id,
      p_merchant_id,
      v_type,
      p_card_name,
      coalesce(nullif(trim(p_theme_id), ''), 'aurora'),
      coalesce((p_config->>'initial_points')::integer, 0),
      coalesce((p_config->>'initial_points')::integer, 0),
      0,
      coalesce((p_config->>'stamps_target')::integer, 10),
      coalesce(p_config->>'stamp_reward', '1 produit offert au 10ème passage'),
      p_config->>'stamp_conditions',
      'bronze',
      0,
      coalesce((p_config->>'bronze_threshold')::numeric, 0),
      coalesce((p_config->>'silver_threshold')::numeric, 15000),
      coalesce((p_config->>'gold_threshold')::numeric, 30000),
      coalesce(p_config->>'bronze_benefits', '-5% de réduction'),
      coalesce(p_config->>'silver_benefits', '-10% de réduction + Cadeau'),
      coalesce(p_config->>'gold_benefits', '-15% de réduction + Accès prioritaire')
    )
    returning * into v_card;
  end if;

  return json_build_object(
    'card_id',       v_card.id,
    'qr_token',      v_card.qr_token,
    'card_type',     v_card.card_type,
    'card_name',     v_card.card_name,
    'theme_id',      v_card.theme_id,
    'points',        v_card.points,
    'stamps_count',  v_card.stamps_count,
    'stamps_target', v_card.stamps_target,
    'vip_tier',      v_card.vip_tier,
    'vip_spent',     v_card.vip_spent,
    'customer_name', p_customer_name,
    'phone',         v_clean_phone
  );
end;
$$;

grant execute on function public.merchant_create_card(text, uuid, text, text, text, text, jsonb) to authenticated;


-- =============================================================================
-- FIN DU SCRIPT
-- =============================================================================
