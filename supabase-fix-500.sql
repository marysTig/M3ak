-- ============================================================
-- FIX ERREUR 500 "Database error querying schema"
-- ============================================================
-- IMPORTANT : Exécuter dans Supabase SQL Editor
-- Copier CHAQUE BLOC séparément, l'exécuter, et passer au suivant.
-- ============================================================


-- ============ BLOC 1 : SUPPRIMER TOUS LES TRIGGERS SUR auth.users ============
-- C'est la CAUSE de l'erreur 500. Les triggers se déclenchent
-- pendant le login (UPDATE last_sign_in_at) et s'ils sont cassés → 500.
DROP TRIGGER IF EXISTS on_auth_user_created    ON auth.users;
DROP TRIGGER IF EXISTS trg_auto_confirm_user   ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated    ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Vérifier qu'il n'y a plus aucun trigger sur auth.users :
SELECT tgname AS trigger_name, tgtype, proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' AND c.relname = 'users'
  AND NOT t.tgisinternal;
-- LE RÉSULTAT DOIT ÊTRE VIDE (0 lignes). Si des triggers restent, copie leurs noms.


-- ============ BLOC 2 : AJOUTER LES COLONNES MANQUANTES DANS profiles ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wilaya   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone    text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes    text;

-- Vérifier si la colonne status existe déjà
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN status text DEFAULT 'active';
  END IF;
END $$;

-- Vérification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;


-- ============ BLOC 3 : CONFIRMER TOUS LES COMPTES EXISTANTS ============
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Lister tous les utilisateurs pour voir ce qui existe
SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed,
       raw_user_meta_data->>'role' AS meta_role
FROM auth.users;


-- ============ BLOC 4 : CRÉER / METTRE À JOUR LE COMPTE ADMIN ============
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Chercher un utilisateur existant avec cet email
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'marys@m3ak.app';

  IF v_user_id IS NULL THEN
    -- Le compte n'existe pas : le créer
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      role, aud, created_at, updated_at
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'marys@m3ak.app',
      crypt('marys062002', gen_salt('bf')),
      NOW(), NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"marys","role":"admin","username":"marys"}',
      'authenticated', 'authenticated', NOW(), NOW()
    );
    RAISE NOTICE 'Compte admin CRÉÉ avec id=%', v_user_id;
  ELSE
    -- Le compte existe : mettre à jour le mot de passe
    UPDATE auth.users SET
      encrypted_password  = crypt('marys062002', gen_salt('bf')),
      email_confirmed_at  = COALESCE(email_confirmed_at, NOW()),
      raw_user_meta_data  = COALESCE(raw_user_meta_data, '{}'::jsonb) ||
                            '{"role":"admin","full_name":"marys","username":"marys"}'::jsonb,
      raw_app_meta_data   = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
                            '{"provider":"email","providers":["email"]}'::jsonb,
      updated_at          = NOW()
    WHERE id = v_user_id;
    RAISE NOTICE 'Compte admin MIS À JOUR avec id=%', v_user_id;
  END IF;

  -- Créer le profil admin
  INSERT INTO public.profiles (id, full_name, role, username, status)
  VALUES (v_user_id, 'marys', 'admin', 'marys', 'active')
  ON CONFLICT (id) DO UPDATE SET
    role       = 'admin',
    full_name  = 'marys',
    username   = 'marys',
    status     = 'active',
    updated_at = NOW();

  RAISE NOTICE 'Profil admin OK';
END $$;

-- Vérification finale
SELECT u.email, u.email_confirmed_at IS NOT NULL AS confirmed,
       p.role, p.username, p.status
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'marys@m3ak.app';


-- ============ BLOC 5 : RECRÉER LES TRIGGERS (PROPRES) ============
-- À exécuter SEULEMENT après avoir vérifié que le login fonctionne
-- sans triggers (blocs 1-4 suffisent pour le test).

-- Fonction handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_full_name text;
  v_role      text;
  v_username  text;
  v_phone     text;
BEGIN
  v_username  := split_part(NEW.email, '@', 1);
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), v_username);
  v_role      := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''), 'merchant');
  v_phone     := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  INSERT INTO public.profiles (id, full_name, phone, role, username, status)
  VALUES (NEW.id, v_full_name, v_phone, v_role,
          COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), v_username),
          'active')
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    phone      = COALESCE(EXCLUDED.phone, profiles.phone),
    role       = EXCLUDED.role,
    username   = COALESCE(EXCLUDED.username, profiles.username),
    updated_at = NOW();

  -- Si merchant : créer la fiche commerce
  IF v_role = 'merchant' THEN
    DECLARE v_slug text; v_merchant_id uuid;
    BEGIN
      v_slug := REGEXP_REPLACE(LOWER(v_full_name), '[^a-z0-9]+', '-', 'g');
      v_slug := TRIM(BOTH '-' FROM v_slug);
      IF v_slug = '' THEN v_slug := 'commerce'; END IF;
      v_slug := v_slug || '-' || SUBSTRING(NEW.id::text, 1, 5);

      INSERT INTO public.merchants (owner_id, name, slug, status, plan, is_trial, subscription_expires_at)
      VALUES (NEW.id, v_full_name, v_slug, 'active', 'starter', true, NOW() + INTERVAL '7 days')
      ON CONFLICT (owner_id) DO NOTHING;

      SELECT id INTO v_merchant_id FROM public.merchants WHERE owner_id = NEW.id;
      IF v_merchant_id IS NOT NULL THEN
        INSERT INTO public.loyalty_programs (merchant_id, theme_id, status)
        VALUES (v_merchant_id, 'aurora', 'active')
        ON CONFLICT (merchant_id) DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-confirmation
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
