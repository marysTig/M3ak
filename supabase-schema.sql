-- =============================================================================
-- M3ak — Schéma Supabase COMPLET v2
-- =============================================================================
-- Exécutez ce script dans SQL Editor → New query → Run
-- ATTENTION : Supprime les tables v1 si elles existent et les recrée proprement.
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Nettoyer v1 si elle existe ───────────────────────────────────────────────
drop table if exists public.transactions cascade;
drop table if exists public.reward_redemptions cascade;
drop table if exists public.loyalty_cards cascade;
drop table if exists public.rewards cascade;
drop table if exists public.loyalty_programs cascade;
drop table if exists public.stores cascade;
drop table if exists public.merchants cascade;
drop table if exists public.customers cascade;
drop table if exists public.merchant_themes cascade;
drop table if exists public.profiles cascade;

-- ─── profiles — Extension de auth.users ──────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        text not null default 'customer' check (role in ('admin', 'merchant', 'customer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── merchants ────────────────────────────────────────────────────────────────
create table public.merchants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  category    text,
  email       text,
  phone       text,
  address     text,
  logo_url    text,
  slug        text unique,           -- utilisé dans le lien QR : /join/{slug}
  plan        text not null default 'starter' check (plan in ('starter', 'growth', 'pro')),
  status      text not null default 'pending' check (status in ('active', 'pending', 'suspended')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── stores — Points de vente d'un commerce ───────────────────────────────────
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name        text not null default 'Principal',
  created_at  timestamptz not null default now()
);

-- ─── loyalty_programs — Règles + thème du programme ─────────────────────────
create table public.loyalty_programs (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null unique references public.merchants(id) on delete cascade,
  name             text not null default 'Programme de fidélité',
  theme_id         text not null default 'aurora',
  points_per_euro  integer not null default 1 check (points_per_euro > 0),
  status           text not null default 'active' check (status in ('active', 'suspended')),
  email_notif      boolean not null default true,
  reward_notif     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ─── rewards — Récompenses disponibles pour un commerce ──────────────────────
create table public.rewards (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name        text not null,
  description text not null default '',
  icon        text not null default 'gift',
  points_cost integer not null check (points_cost >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── loyalty_cards — Une carte par client par commerce ───────────────────────
create table public.loyalty_cards (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  merchant_id   uuid not null references public.merchants(id) on delete cascade,
  store_id      uuid references public.stores(id),
  qr_token      text not null unique default encode(gen_random_bytes(16), 'hex'),
  points        integer not null default 0 check (points >= 0),
  total_earned  integer not null default 0 check (total_earned >= 0),
  status        text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (customer_id, merchant_id)
);

-- ─── transactions — Historique points (immutable, append-only) ───────────────
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references public.loyalty_cards(id) on delete cascade,
  merchant_id      uuid not null references public.merchants(id),
  store_id         uuid references public.stores(id),
  created_by       uuid references public.profiles(id),
  points_delta     integer not null,  -- positif = gain, négatif = échange
  tx_type          text not null check (tx_type in ('earned', 'redeemed', 'adjustment', 'welcome')),
  description      text not null default '',
  previous_balance integer not null check (previous_balance >= 0),
  new_balance      integer not null check (new_balance >= 0),
  created_at       timestamptz not null default now()
);

-- ─── reward_redemptions — Échanges de récompenses ────────────────────────────
create table public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  card_id      uuid not null references public.loyalty_cards(id) on delete cascade,
  reward_id    uuid not null references public.rewards(id),
  transaction_id uuid references public.transactions(id),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  points_spent integer not null check (points_spent > 0),
  redeemed_at  timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index idx_merchants_owner on public.merchants(owner_id);
create index idx_merchants_slug on public.merchants(slug);
create index idx_merchants_status on public.merchants(status);
create index idx_stores_merchant on public.stores(merchant_id);
create index idx_lp_merchant on public.loyalty_programs(merchant_id);
create index idx_rewards_merchant on public.rewards(merchant_id);
create index idx_cards_customer on public.loyalty_cards(customer_id);
create index idx_cards_merchant on public.loyalty_cards(merchant_id);
create index idx_cards_qr_token on public.loyalty_cards(qr_token);
create index idx_tx_card on public.transactions(card_id);
create index idx_tx_merchant on public.transactions(merchant_id);
create index idx_tx_created_at on public.transactions(created_at desc);
create index idx_redemptions_card on public.reward_redemptions(card_id);

-- ─── Triggers updated_at ─────────────────────────────────────────────────────
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

-- ─── Trigger : créer le profil automatiquement à la création d'utilisateur ───
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_full_name text;
  v_role      text;
  v_username  text;
begin
  -- Extraire le username depuis l'email synthétique (format: username@m3ak.app)
  if new.email like '%@m3ak.app' then
    v_username := split_part(new.email, '@', 1);
  else
    v_username := split_part(new.email, '@', 1);
  end if;

  -- Nom complet : priorité au metadata, puis au username
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    v_username,
    new.email,
    'Utilisateur'
  );

  -- Rôle : priorité au metadata, défaut customer
  v_role := coalesce(
    nullif(trim(new.raw_user_meta_data->>'role'), ''),
    'customer'
  );

  insert into public.profiles (id, full_name, role)
  values (new.id, v_full_name, v_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        role      = excluded.role,
        updated_at = now();

  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RPC : add_points (atomique, SECURITY DEFINER) ───────────────────────────
-- Le frontend appelle supabase.rpc('add_points', {...})
-- La vérification du marchand se fait CÔTÉ SERVEUR via auth.uid()
create or replace function public.add_points(
  p_qr_token    text,
  p_points      integer,
  p_description text default ''
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_caller_id   uuid := auth.uid();
  v_merchant    public.merchants%rowtype;
  v_card        public.loyalty_cards%rowtype;
  v_program     public.loyalty_programs%rowtype;
  v_store_id    uuid;
  v_prev_bal    integer;
  v_new_bal     integer;
  v_tx          public.transactions%rowtype;
begin
  -- Vérifier que l'appelant est authentifié
  if v_caller_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Récupérer le commerce du commerçant connecté
  select * into v_merchant
  from public.merchants where owner_id = v_caller_id limit 1;

  if not found then
    raise exception 'Aucun commerce trouvé pour cet utilisateur';
  end if;

  -- Vérifier que le programme est actif
  select * into v_program
  from public.loyalty_programs where merchant_id = v_merchant.id;

  if found and v_program.status = 'suspended' then
    raise exception 'Le programme de fidélité est suspendu';
  end if;

  -- Résoudre le QR token → carte
  select * into v_card
  from public.loyalty_cards
  where qr_token = p_qr_token and merchant_id = v_merchant.id;

  if not found then
    raise exception 'QR invalide ou carte introuvable pour ce commerce';
  end if;

  if v_card.status != 'active' then
    raise exception 'Carte % — opération refusée', v_card.status;
  end if;

  -- Valider le nombre de points
  if p_points <= 0 or p_points > 10000 then
    raise exception 'Nombre de points invalide (1–10000)';
  end if;

  v_prev_bal := v_card.points;
  v_new_bal  := v_prev_bal + p_points;

  -- Récupérer le store principal
  select id into v_store_id from public.stores
  where merchant_id = v_merchant.id order by created_at limit 1;

  -- Mise à jour atomique de la carte
  update public.loyalty_cards set
    points       = v_new_bal,
    total_earned = total_earned + p_points,
    updated_at   = now()
  where id = v_card.id;

  -- Créer la transaction
  insert into public.transactions (
    card_id, merchant_id, store_id, created_by,
    points_delta, tx_type, description, previous_balance, new_balance
  ) values (
    v_card.id, v_merchant.id, v_store_id, v_caller_id,
    p_points, 'earned',
    case when p_description = '' then 'Ajout de points' else p_description end,
    v_prev_bal, v_new_bal
  ) returning * into v_tx;

  return json_build_object(
    'card_id',          v_card.id,
    'customer_id',      v_card.customer_id,
    'previous_balance', v_prev_bal,
    'points_added',     p_points,
    'new_balance',      v_new_bal,
    'transaction_id',   v_tx.id,
    'created_at',       v_tx.created_at
  );
end; $$;

-- ─── RPC : redeem_reward (atomique, SECURITY DEFINER) ────────────────────────
create or replace function public.redeem_reward(
  p_card_id   uuid,
  p_reward_id uuid
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_card      public.loyalty_cards%rowtype;
  v_reward    public.rewards%rowtype;
  v_prev_bal  integer;
  v_new_bal   integer;
  v_tx        public.transactions%rowtype;
  v_redemption public.reward_redemptions%rowtype;
begin
  if v_caller_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Récupérer la carte — doit appartenir à l'appelant
  select * into v_card from public.loyalty_cards
  where id = p_card_id and customer_id = v_caller_id;

  if not found then
    raise exception 'Carte introuvable';
  end if;

  if v_card.status != 'active' then
    raise exception 'Carte non active';
  end if;

  -- Récupérer la récompense
  select * into v_reward from public.rewards
  where id = p_reward_id and merchant_id = v_card.merchant_id and active = true;

  if not found then
    raise exception 'Récompense introuvable ou inactive';
  end if;

  if v_card.points < v_reward.points_cost then
    raise exception 'Solde insuffisant (% pts requis, % pts disponibles)',
      v_reward.points_cost, v_card.points;
  end if;

  v_prev_bal := v_card.points;
  v_new_bal  := v_prev_bal - v_reward.points_cost;

  -- Débiter la carte
  update public.loyalty_cards set
    points     = v_new_bal,
    updated_at = now()
  where id = v_card.id;

  -- Créer la transaction
  insert into public.transactions (
    card_id, merchant_id, store_id, created_by,
    points_delta, tx_type, description, previous_balance, new_balance
  ) values (
    v_card.id, v_card.merchant_id, v_card.store_id, v_caller_id,
    -v_reward.points_cost, 'redeemed',
    v_reward.name, v_prev_bal, v_new_bal
  ) returning * into v_tx;

  -- Créer le redemption
  insert into public.reward_redemptions (
    card_id, reward_id, transaction_id, status, points_spent
  ) values (
    v_card.id, v_reward.id, v_tx.id, 'pending', v_reward.points_cost
  ) returning * into v_redemption;

  return json_build_object(
    'redemption_id',    v_redemption.id,
    'card_id',          v_card.id,
    'reward_name',      v_reward.name,
    'points_spent',     v_reward.points_cost,
    'previous_balance', v_prev_bal,
    'new_balance',      v_new_bal,
    'transaction_id',   v_tx.id
  );
end; $$;

-- ─── RPC : join_merchant (client scanne le QR du commerce) ───────────────────
create or replace function public.join_merchant(
  p_merchant_slug text
)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_caller_id uuid := auth.uid();
  v_merchant  public.merchants%rowtype;
  v_card      public.loyalty_cards%rowtype;
  v_store_id  uuid;
  v_tx        public.transactions%rowtype;
  v_already   boolean := false;
begin
  if v_caller_id is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_merchant from public.merchants
  where slug = p_merchant_slug and status = 'active';

  if not found then
    raise exception 'Commerce introuvable ou inactif';
  end if;

  -- Récupérer le store principal
  select id into v_store_id from public.stores
  where merchant_id = v_merchant.id order by created_at limit 1;

  -- Vérifier si la carte existe déjà (idempotent)
  select * into v_card from public.loyalty_cards
  where customer_id = v_caller_id and merchant_id = v_merchant.id;

  if found then
    v_already := true;
  else
    -- Créer la carte
    insert into public.loyalty_cards (customer_id, merchant_id, store_id)
    values (v_caller_id, v_merchant.id, v_store_id)
    returning * into v_card;

    -- Bonus de bienvenue (+10 pts)
    update public.loyalty_cards set
      points = 10, total_earned = 10, updated_at = now()
    where id = v_card.id;

    insert into public.transactions (
      card_id, merchant_id, store_id, created_by,
      points_delta, tx_type, description, previous_balance, new_balance
    ) values (
      v_card.id, v_merchant.id, v_store_id, v_caller_id,
      10, 'welcome', 'Bonus de bienvenue', 0, 10
    ) returning * into v_tx;
  end if;

  return json_build_object(
    'already_member', v_already,
    'card_id',        v_card.id,
    'merchant_name',  v_merchant.name,
    'merchant_id',    v_merchant.id,
    'qr_token',       v_card.qr_token
  );
end; $$;

-- ─── RLS — Row Level Security ────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.merchants         enable row level security;
alter table public.stores            enable row level security;
alter table public.loyalty_programs  enable row level security;
alter table public.rewards           enable row level security;
alter table public.loyalty_cards     enable row level security;
alter table public.transactions      enable row level security;
alter table public.reward_redemptions enable row level security;

-- profiles : chacun lit/modifie le sien ; admin lit tout
create policy "profiles_self"    on public.profiles for all using (id = auth.uid());
create policy "profiles_admin"   on public.profiles for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- merchants : owner lit/modifie le sien ; admin lit tout ; client voit les actifs
create policy "merchants_owner"  on public.merchants for all
  using (owner_id = auth.uid());
create policy "merchants_admin"  on public.merchants for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "merchants_customer_read" on public.merchants for select
  using (status = 'active');

-- stores : même logique que merchants
create policy "stores_owner" on public.stores for all
  using ((select owner_id from public.merchants where id = merchant_id) = auth.uid());
create policy "stores_admin"  on public.stores for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "stores_read" on public.stores for select using (true);

-- loyalty_programs
create policy "lp_owner" on public.loyalty_programs for all
  using ((select owner_id from public.merchants where id = merchant_id) = auth.uid());
create policy "lp_admin" on public.loyalty_programs for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "lp_read" on public.loyalty_programs for select using (true);

-- rewards : commerçant gère les siennes ; tout le monde lit les actives
create policy "rewards_owner" on public.rewards for all
  using ((select owner_id from public.merchants where id = merchant_id) = auth.uid());
create policy "rewards_admin"  on public.rewards for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "rewards_read"   on public.rewards for select using (active = true);

-- loyalty_cards : client voit les siennes ; commerçant voit celles de son commerce ; admin voit tout
create policy "cards_customer" on public.loyalty_cards for select
  using (customer_id = auth.uid());
create policy "cards_merchant" on public.loyalty_cards for select
  using ((select owner_id from public.merchants where id = merchant_id) = auth.uid());
create policy "cards_admin" on public.loyalty_cards for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
-- INTERDIT : pas d'update direct des points côté client — passe par RPC add_points

-- transactions : client lit les siennes ; commerçant lit celles de son commerce ; admin lit tout
create policy "tx_customer" on public.transactions for select
  using ((select customer_id from public.loyalty_cards where id = card_id) = auth.uid());
create policy "tx_merchant" on public.transactions for select
  using ((select owner_id from public.merchants where id = merchant_id) = auth.uid());
create policy "tx_admin" on public.transactions for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- reward_redemptions
create policy "redemptions_customer" on public.reward_redemptions for select
  using ((select customer_id from public.loyalty_cards where id = card_id) = auth.uid());
create policy "redemptions_merchant" on public.reward_redemptions for all
  using ((select owner_id from public.merchants m
          join public.loyalty_cards c on c.merchant_id = m.id
          where c.id = card_id limit 1) = auth.uid());
create policy "redemptions_admin" on public.reward_redemptions for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ─── platform_settings — Paramètres admin globaux ─────────────────────────────
create table if not exists public.platform_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.platform_settings enable row level security;

create policy "settings_read_all" on public.platform_settings for select
  using (true);
create policy "settings_admin_write" on public.platform_settings for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

