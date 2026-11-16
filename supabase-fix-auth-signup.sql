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

-- ─── 7. Confirmation ──────────────────────────────────────────────────────────
SELECT 'Fix appliqué avec succès !' AS resultat;
