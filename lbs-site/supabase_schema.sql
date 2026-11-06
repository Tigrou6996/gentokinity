-- ============================================================
-- LBS DATABASE SCHEMA — VERSIONE COMPLETA
-- Esegui queste query nell'editor SQL di Supabase
-- Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Tabella profili utenti (collegata a auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Trigger: crea automaticamente un profilo quando un utente si registra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Tabella richieste di contatto (modulo contatti)
CREATE TABLE IF NOT EXISTS public.contact_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  messaggio TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact requests"
  ON public.contact_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can read contact requests"
  ON public.contact_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete contact requests"
  ON public.contact_requests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Tabella candidature (modulo candidatura dalla homepage)
CREATE TABLE IF NOT EXISTS public.candidature (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  settore TEXT,
  messaggio TEXT,
  stato TEXT NOT NULL DEFAULT 'nuova' CHECK (stato IN ('nuova', 'in_lavorazione', 'completata', 'rifiutata')),
  note_admin TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.candidature ENABLE ROW LEVEL SECURITY;

-- Chiunque (anche non loggato) può inviare una candidatura
CREATE POLICY "Anyone can insert candidature"
  ON public.candidature FOR INSERT
  WITH CHECK (true);

-- Solo gli admin possono leggere le candidature
CREATE POLICY "Admin can read candidature"
  ON public.candidature FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo gli admin possono aggiornare le candidature (cambiare stato)
CREATE POLICY "Admin can update candidature"
  ON public.candidature FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo gli admin possono eliminare candidature
CREATE POLICY "Admin can delete candidature"
  ON public.candidature FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Tabella offerte di lavoro
CREATE TABLE IF NOT EXISTS public.offerte_lavoro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titolo TEXT NOT NULL,
  azienda TEXT,
  citta TEXT NOT NULL,
  stato_germania TEXT NOT NULL DEFAULT '',
  settore TEXT NOT NULL,
  contratto TEXT NOT NULL DEFAULT 'Tempo Indeterminato',
  stipendio_min INTEGER,
  stipendio_max INTEGER,
  descrizione TEXT NOT NULL,
  requisiti TEXT,
  attiva BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.offerte_lavoro ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere le offerte attive (anche non loggati)
CREATE POLICY "Anyone can read active offerte"
  ON public.offerte_lavoro FOR SELECT
  USING (attiva = true OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Solo gli admin possono inserire offerte
CREATE POLICY "Admin can insert offerte"
  ON public.offerte_lavoro FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo gli admin possono aggiornare offerte
CREATE POLICY "Admin can update offerte"
  ON public.offerte_lavoro FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo gli admin possono eliminare offerte
CREATE POLICY "Admin can delete offerte"
  ON public.offerte_lavoro FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- SETUP ADMIN: dopo aver eseguito lo script:
-- 1. Vai su Authentication > Users
-- 2. Crea un utente con email e password
-- 3. Poi esegui (sostituisci con la tua email):
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'tua-email@esempio.com';
-- ============================================================

-- ============================================================
-- MIGRAZIONE v2 — Nuove colonne offerte + Storage immagini
-- Esegui questo blocco separatamente se la tabella esiste già
-- ============================================================

-- Colonne aggiuntive per offerte
ALTER TABLE public.offerte_lavoro 
  ADD COLUMN IF NOT EXISTS in_evidenza BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS immagine_url TEXT;

-- Indice univoco sullo slug
CREATE UNIQUE INDEX IF NOT EXISTS offerte_lavoro_slug_idx ON public.offerte_lavoro (slug) WHERE slug IS NOT NULL;

-- Storage bucket per le immagini delle offerte (creare manualmente dal Dashboard Supabase)
-- 1. Vai su Storage > New Bucket
-- 2. Nome: offerte-images
-- 3. Spunta "Public bucket"

-- Policy storage (eseguire dopo aver creato il bucket)
CREATE POLICY IF NOT EXISTS "Public read offerte images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'offerte-images');

CREATE POLICY IF NOT EXISTS "Admin upload offerte images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'offerte-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "Admin delete offerte images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'offerte-images' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- MIGRAZIONE v3 — Tipo stipendio e modalità
-- Esegui questo blocco separatamente se la tabella esiste già
-- ============================================================

-- stipendio_tipo: 'netto' o 'lordo' (default: 'lordo')
-- stipendio_modalita: 'range' (min-max), 'fisso' (solo min), 'a_partire_da' (solo min, mostra "a partire da")
ALTER TABLE public.offerte_lavoro
  ADD COLUMN IF NOT EXISTS stipendio_tipo TEXT NOT NULL DEFAULT 'lordo',
  ADD COLUMN IF NOT EXISTS stipendio_modalita TEXT NOT NULL DEFAULT 'range';
