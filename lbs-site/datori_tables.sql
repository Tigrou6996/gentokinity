-- ============================================================
-- TABELLE DATORI DI LAVORO
-- Esegui questo script nell'editor SQL di Supabase
-- ============================================================

-- 1. Tabella richieste ricevute dal form della pagina /datori-di-lavoro
CREATE TABLE IF NOT EXISTS public.datori_richieste (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_azienda    text NOT NULL,
  nome_referente  text,
  email           text NOT NULL,
  telefono        text,
  settore_ricerca text,
  num_lavoratori  text,
  messaggio       text,
  stato           text NOT NULL DEFAULT 'nuova'
                  CHECK (stato IN ('nuova', 'in_lavorazione', 'completata')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: solo gli admin leggono e modificano
ALTER TABLE public.datori_richieste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access datori_richieste"
  ON public.datori_richieste
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Chiunque (anche non autenticato) può inserire una richiesta
CREATE POLICY "Anyone can submit datori_richieste"
  ON public.datori_richieste
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);


-- 2. Tabella datori gestiti (gestita manualmente dall'admin)
CREATE TABLE IF NOT EXISTS public.datori_gestiti (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_azienda    text NOT NULL,
  nome_referente  text,
  email           text,
  telefono        text,
  settori         text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: solo gli admin
ALTER TABLE public.datori_gestiti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access datori_gestiti"
  ON public.datori_gestiti
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
