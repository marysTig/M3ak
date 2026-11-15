-- =============================================================================
-- MODULE PROSPECTION & CRM M3AK — TABLES DÉDIÉES
-- À exécuter dans Supabase Dashboard → SQL Editor
-- =============================================================================

-- 1. Table des imports Excel (historique des fichiers importés)
CREATE TABLE IF NOT EXISTS public.prospect_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  imported_rows int NOT NULL DEFAULT 0,
  rejected_rows int NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Table principale des prospects (CRM)
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wilaya text NOT NULL,
  commune text,
  phone text,
  activity text,
  status text NOT NULL DEFAULT 'callback' 
    CHECK (status IN ('callback', 'trial', 'rejected', 'new', 'contacted', 'interested', 'meeting_scheduled', 'negotiation')),
  finale text DEFAULT NULL 
    CHECK (finale IS NULL OR finale IN ('paid', 'unpaid')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  import_id uuid REFERENCES public.prospect_imports(id) ON DELETE SET NULL,
  notes text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  converted_at timestamptz,
  commission_amount numeric DEFAULT 0,
  commission_paid boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Si la table prospects existait déjà, s'assurer que toutes les nouvelles colonnes sont présentes :
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS finale text DEFAULT NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS import_id uuid REFERENCES public.prospect_imports(id) ON DELETE SET NULL;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS activity text;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS converted_at timestamptz;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS commission_amount numeric DEFAULT 0;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS commission_paid boolean DEFAULT false;

-- 3. Table des assignations en lot
CREATE TABLE IF NOT EXISTS public.prospect_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospector_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  count int NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Table du journal d'activités commerciales
CREATE TABLE IF NOT EXISTS public.prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('call', 'meeting', 'note', 'status_change', 'finale_change', 'assignment')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Trigger d'actualisation de updated_at
CREATE OR REPLACE TRIGGER trg_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Trigger de sécurité : seul un ADMIN peut modifier la colonne "finale"
CREATE OR REPLACE FUNCTION public.check_prospect_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role text;
BEGIN
  -- Récupérer le rôle de l'utilisateur connecté
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  -- Si un utilisateur non-admin tente de modifier la colonne "finale"
  IF (OLD.finale IS DISTINCT FROM NEW.finale) AND (v_role IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'Seul un administrateur peut modifier la décision Finale (Payé / Non payé).';
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_check_prospect_permissions ON public.prospects;
CREATE TRIGGER trg_check_prospect_permissions
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.check_prospect_permissions();

-- 7. Activer Row Level Security (RLS)
ALTER TABLE public.prospect_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

-- 8. Politiques RLS pour prospects
DROP POLICY IF EXISTS "prospects_admin_all" ON public.prospects;
CREATE POLICY "prospects_admin_all" ON public.prospects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "prospects_prospector_own" ON public.prospects;
CREATE POLICY "prospects_prospector_own" ON public.prospects
  FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "prospects_prospector_update_own" ON public.prospects;
CREATE POLICY "prospects_prospector_update_own" ON public.prospects
  FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
  )
  WITH CHECK (
    assigned_to = auth.uid()
  );

-- Politiques RLS pour prospect_imports (Admin uniquement)
DROP POLICY IF EXISTS "imports_admin_all" ON public.prospect_imports;
CREATE POLICY "imports_admin_all" ON public.prospect_imports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Politiques RLS pour prospect_assignments (Admin uniquement)
DROP POLICY IF EXISTS "assignments_admin_all" ON public.prospect_assignments;
CREATE POLICY "assignments_admin_all" ON public.prospect_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Politiques RLS pour prospect_activities
DROP POLICY IF EXISTS "activities_select" ON public.prospect_activities;
CREATE POLICY "activities_select" ON public.prospect_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "activities_insert" ON public.prospect_activities;
CREATE POLICY "activities_insert" ON public.prospect_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- 9. Permissions d'accès globales pour les utilisateurs authentifiés
GRANT ALL ON public.prospect_imports TO authenticated;
GRANT ALL ON public.prospects TO authenticated;
GRANT ALL ON public.prospect_assignments TO authenticated;
GRANT ALL ON public.prospect_activities TO authenticated;

