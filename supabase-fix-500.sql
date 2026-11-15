-- ============================================================
-- FIX URGENT : Erreur 500 "Database error querying schema"
-- À exécuter dans Supabase Dashboard → SQL Editor
-- ============================================================

-- ÉTAPE 1 : Supprimer les triggers potentiellement cassés
DROP TRIGGER IF EXISTS on_auth_user_created     ON auth.users;
DROP TRIGGER IF EXISTS trg_auto_confirm_user    ON auth.users;
DROP TRIGGER IF EXISTS trg_profiles_updated_at  ON public.profiles;
DROP TRIGGER IF EXISTS trg_merchants_updated_at ON public.merchants;

-- ÉTAPE 2 : Recréer la fonction set_updated_at (simple, sans risque)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;

-- ÉTAPE 3 : Recréer les triggers updated_at sur les tables publiques (pas auth)
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ÉTAPE 4 : Ajouter les colonnes manquantes dans profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status  text DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'pending'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wilaya  text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes   text;

-- ÉTAPE 5 : Recréer handle_new_user (proprement)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  v_full_name   text;
  v_role        text;
  v_username    text;
  v_slug        text;
  v_phone       text;
  v_merchant_id uuid;
BEGIN
  v_username := split_part(NEW.email, '@', 1);

  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    v_username,
    NEW.email,
    'Utilisateur'
  );

  v_role := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
    'merchant'
  );

  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  -- Créer ou mettre à jour le profil
  INSERT INTO public.profiles (id, full_name, phone, role, username, status)
  VALUES (
    NEW.id,
    v_full_name,
    v_phone,
    v_role,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), v_username),
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name,  public.profiles.full_name),
    phone      = COALESCE(EXCLUDED.phone,      public.profiles.phone),
    role       = COALESCE(EXCLUDED.role,       public.profiles.role),
    username   = COALESCE(EXCLUDED.username,   public.profiles.username),
    status     = COALESCE(public.profiles.status, 'active'),
    updated_at = NOW();

  -- Si merchant : créer la fiche commerce
  IF v_role = 'merchant' THEN
    v_slug := REGEXP_REPLACE(LOWER(v_full_name), '[^a-z0-9]+', '-', 'g');
    v_slug := TRIM(BOTH '-' FROM v_slug);
    IF v_slug = '' THEN v_slug := 'commerce'; END IF;
    v_slug := v_slug || '-' || SUBSTRING(NEW.id::text, 1, 5);

    INSERT INTO public.merchants (owner_id, name, slug, status, plan, is_trial, subscription_expires_at)
    VALUES (
      NEW.id,
      v_full_name,
      v_slug,
      'active',
      'starter',
      true,
      NOW() + INTERVAL '7 days'
    )
    ON CONFLICT (owner_id) DO NOTHING;

    -- Créer un programme de fidélité par défaut
    SELECT id INTO v_merchant_id FROM public.merchants WHERE owner_id = NEW.id;
    IF v_merchant_id IS NOT NULL THEN
      INSERT INTO public.loyalty_programs (merchant_id, theme_id, status)
      VALUES (v_merchant_id, 'aurora', 'active')
      ON CONFLICT (merchant_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

-- ÉTAPE 6 : Recréer le trigger handle_new_user sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ÉTAPE 7 : Auto-confirmation (évite "Email not confirmed")
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- ÉTAPE 8 : Confirmer rétroactivement tous les comptes existants
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ÉTAPE 9 : Créer/mettre à jour le compte admin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'marys@m3ak.app';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role, aud
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'marys@m3ak.app',
      extensions.crypt('marys062002', extensions.gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"],"role":"admin"}',
      '{"full_name":"marys","role":"admin","username":"marys"}',
      'authenticated', 'authenticated'
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password  = extensions.crypt('marys062002', extensions.gen_salt('bf')),
      email_confirmed_at  = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data  = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
                            '{"role":"admin","full_name":"marys","username":"marys"}'::jsonb,
      updated_at          = NOW()
    WHERE id = v_user_id;
  END IF;

  -- Mettre à jour le profil admin
  INSERT INTO public.profiles (id, full_name, role, username, status)
  VALUES (v_user_id, 'marys', 'admin', 'marys', 'active')
  ON CONFLICT (id) DO UPDATE SET
    role       = 'admin',
    full_name  = 'marys',
    username   = 'marys',
    status     = 'active',
    updated_at = NOW();
END $$;

-- VÉRIFICATION FINALE
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS confirmed,
  p.role,
  p.username,
  p.status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'marys@m3ak.app';

