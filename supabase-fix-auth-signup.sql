-- =============================================================================
-- M3ak — CORRECTIF COMPLET INSCRIPTION (429, Email not confirmed, 400 merchants)
-- À exécuter dans Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================================

-- ─── 1. Ajouter les colonnes manquantes dans merchants (si absentes) ───────────
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT true;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS phone text;

-- ─── 2. Ajouter les colonnes manquantes dans profiles (si absentes) ───────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wilaya text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commune text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- ─── 3. Mettre à jour la contrainte de rôle (autoriser 'prospector') ──────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'merchant', 'customer', 'prospector'));

-- ─── 4. Auto-confirmation des emails (supprime le blocage "Email not confirmed") ─
-- Ce trigger confirme automatiquement chaque nouveau compte sans email réel
DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, NOW());
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- Confirmer rétroactivement tous les comptes déjà existants non confirmés
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ─── 5. Recréer le trigger handle_new_user (crée profil + commerce auto) ──────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
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
    'customer'
  );

  v_phone := NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '');

  -- Création ou mise à jour du profil
  INSERT INTO public.profiles (id, full_name, phone, role)
  VALUES (NEW.id, v_full_name, v_phone, v_role)
  ON CONFLICT (id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        phone      = COALESCE(EXCLUDED.phone, public.profiles.phone),
        role       = EXCLUDED.role,
        updated_at = NOW();

  -- Si rôle = merchant, créer automatiquement la fiche commerce et le programme
  IF v_role = 'merchant' THEN
    v_slug := LOWER(REGEXP_REPLACE(v_username, '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTR(NEW.id::text, 1, 5);

    IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE owner_id = NEW.id) THEN
      INSERT INTO public.merchants (owner_id, name, slug, phone, status, plan, subscription_expires_at, is_trial)
      VALUES (NEW.id, v_full_name, v_slug, v_phone, 'active', 'starter', NOW() + INTERVAL '7 days', true)
      RETURNING id INTO v_merchant_id;

      IF v_merchant_id IS NOT NULL THEN
        INSERT INTO public.loyalty_programs (merchant_id, theme_id, status)
        VALUES (v_merchant_id, 'aurora', 'active')
        ON CONFLICT (merchant_id) DO NOTHING;
      END IF;
    ELSE
      UPDATE public.merchants
      SET phone = COALESCE(v_phone, public.merchants.phone)
      WHERE owner_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 6. Synchronisation rétroactive (marchands sans fiche commerce) ───────────
INSERT INTO public.merchants (owner_id, name, slug, status, plan, subscription_expires_at, is_trial)
SELECT
  p.id,
  COALESCE(p.full_name, 'Commerce'),
  LOWER(REGEXP_REPLACE(COALESCE(p.full_name, 'commerce'), '[^a-zA-Z0-9]', '-', 'g')) || '-' || SUBSTR(p.id::text, 1, 5),
  'active',
  'starter',
  NOW() + INTERVAL '7 days',
  true
FROM public.profiles p
WHERE p.role = 'merchant'
  AND NOT EXISTS (SELECT 1 FROM public.merchants m WHERE m.owner_id = p.id)
ON CONFLICT DO NOTHING;

-- Créer loyalty_programs pour les marchands qui n'en ont pas
INSERT INTO public.loyalty_programs (merchant_id, theme_id, status)
SELECT m.id, 'aurora', 'active'
FROM public.merchants m
WHERE NOT EXISTS (SELECT 1 FROM public.loyalty_programs lp WHERE lp.merchant_id = m.id)
ON CONFLICT (merchant_id) DO NOTHING;

-- ─── 7. Fonction RPC admin_create_prospector (Création directe sans 429 ni duplicate key) ───
-- Auto-réparatrice : si le compte auth existait déjà suite à un échec précédent (ex: "liza"),
-- elle met à jour le mot de passe, restaure toutes les colonnes GoTrue et complète public.profiles !
DROP FUNCTION IF EXISTS public.admin_create_prospector(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.admin_create_prospector(
  p_username text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_wilaya text,
  p_commune text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id     uuid;
  v_email       text;
  v_caller_role text;
BEGIN
  -- 1. Vérifier que l'utilisateur qui appelle est bien administrateur
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.';
  END IF;

  -- 2. Nettoyer et valider le username
  p_username := lower(trim(p_username));
  IF length(p_username) < 3 THEN
    RAISE EXCEPTION 'Le nom d''utilisateur doit comporter au moins 3 caractères.';
  END IF;

  v_email := p_username || '@m3ak.app';

  -- 3. Vérifier si l'utilisateur existe déjà dans auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Utilisateur existant (ex: tentative antérieure interrompue) :
    -- Mettre à jour le mot de passe, confirmer le compte et synchroniser toutes les colonnes requises par GoTrue
    UPDATE auth.users
    SET encrypted_password           = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at           = COALESCE(email_confirmed_at, NOW()),
        confirmation_token           = '',
        recovery_token               = '',
        email_change_token_new       = '',
        phone_change_token           = '',
        phone_change                 = '',
        email_change                 = '',
        email_change_confirm_status  = 0,
        reauthentication_token       = '',
        raw_app_meta_data            = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data           = jsonb_build_object(
          'full_name', p_full_name,
          'username', p_username,
          'role', 'prospector',
          'phone', p_phone,
          'wilaya', p_wilaya,
          'commune', p_commune
        ),
        is_super_admin               = FALSE,
        is_sso_user                  = FALSE,
        is_anonymous                 = FALSE,
        banned_until                 = NULL,
        deleted_at                   = NULL,
        role                         = 'authenticated',
        aud                          = 'authenticated',
        updated_at                   = NOW()
    WHERE id = v_user_id;

    -- S'assurer que l'identité existe
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      v_email,
      'email',
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'provider', 'email'
      ),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      identity_data = EXCLUDED.identity_data,
      updated_at    = NOW();

  ELSE
    -- Nouvel utilisateur : insérer dans auth.users avec TOUTES les colonnes requises par GoTrue
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      email_change_token_current,
      email_change_confirm_status,
      banned_until,
      reauthentication_token,
      reauthentication_sent_at,
      is_sso_user,
      deleted_at,
      is_anonymous,
      role,
      aud
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
      NOW(),
      NULL,
      '',
      NULL,
      '',
      NULL,
      '',
      '',
      NULL,
      NULL,
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', p_full_name,
        'username', p_username,
        'role', 'prospector',
        'phone', p_phone,
        'wilaya', p_wilaya,
        'commune', p_commune
      ),
      FALSE,
      NOW(),
      NOW(),
      NULL,
      NULL,
      '',
      '',
      NULL,
      '',
      0,
      NULL,
      '',
      NULL,
      FALSE,
      NULL,
      FALSE,
      'authenticated',
      'authenticated'
    );

    -- Insérer dans auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      v_email,
      'email',
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'provider', 'email'
      ),
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;

  -- 4. Insérer ou mettre à jour dans public.profiles (avec ON CONFLICT pour éviter tout doublon)
  INSERT INTO public.profiles (
    id,
    full_name,
    username,
    role,
    phone,
    wilaya,
    commune,
    notes,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_full_name,
    p_username,
    'prospector',
    p_phone,
    p_wilaya,
    p_commune,
    p_notes,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = EXCLUDED.full_name,
    username   = EXCLUDED.username,
    role       = 'prospector',
    phone      = EXCLUDED.phone,
    wilaya     = EXCLUDED.wilaya,
    commune    = EXCLUDED.commune,
    notes      = EXCLUDED.notes,
    status     = 'active',
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'username', p_username
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_prospector TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_prospector TO service_role;

-- ─── 8. Fonction RPC admin_delete_prospector (Suppression propre en cascade) ───
-- DROP requis si le type de retour a changé depuis l'ancienne version
DROP FUNCTION IF EXISTS public.admin_delete_prospector(uuid);
CREATE OR REPLACE FUNCTION public.admin_delete_prospector(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.';
  END IF;

  DELETE FROM public.prospect_assignments WHERE prospector_id = p_user_id;
  UPDATE public.prospects SET assigned_to = NULL, assigned_at = NULL WHERE assigned_to = p_user_id;
  UPDATE public.prospect_activities SET prospector_id = NULL WHERE prospector_id = p_user_id;
  DELETE FROM public.commissions WHERE prospector_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_prospector TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_prospector TO service_role;

-- ─── 9. Confirmation ──────────────────────────────────────────────────────────
SELECT 'Fix appliqué avec succès ! admin_create_prospector et admin_delete_prospector sont opérationnels.' AS resultat;
