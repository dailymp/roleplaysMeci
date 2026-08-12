-- Voz por persona + autoevaluación del sistema.
--
-- 1. personas.voice_id: hasta ahora todos los prospectos hablaban con la voz
--    por defecto del agente de ElevenLabs, así que Laura y Marta sonaban a
--    hombre. Si queda a null se usa la voz del panel (comportamiento anterior).
-- 2. auto_evaluations: la evaluación que hace el sistema leyendo la
--    transcripción. Una por sesión, siempre, haya o no autoevaluación manual.

alter table public.personas
  add column if not exists voice_id text;

-- Voces por defecto de ElevenLabs (disponibles en cualquier cuenta).
-- Cambiar aquí si se prefieren otras: update personas set voice_id = '...' where id = '...';
update public.personas set voice_id = 'EXAVITQu4vr4xnSDxMaL' where id = 'laura';  -- Sarah, femenina cercana
update public.personas set voice_id = 'TX3LSARhy8UBI9uY5ScO' where id = 'carlos'; -- Liam, masculina joven
update public.personas set voice_id = 'Xb7hH8MSUJpSbSDYk0k2' where id = 'marta';  -- Alice, femenina firme
update public.personas set voice_id = 'pqHfZKP75CvOlQylNhV4' where id = 'andres'; -- Bill, masculina dominante

create table if not exists public.auto_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_scores jsonb not null default '{}'::jsonb,
  evidencias jsonb not null default '{}'::jsonb,
  m_score integer not null default 0,
  e_score integer not null default 0,
  c_score integer not null default 0,
  i_score integer not null default 0,
  total_score integer not null default 0,
  banda text not null default '',
  fase_debil text not null default 'M' check (fase_debil in ('M', 'E', 'C', 'I')),
  metricas jsonb not null default '{}'::jsonb,
  puntos_fuertes text[] not null default '{}',
  puntos_debiles text[] not null default '{}',
  momento_clave_positivo text,
  momento_clave_negativo text,
  frase_dolor_real text,
  ejercicio_siguiente text,
  resumen text,
  error text,
  modelo text,
  created_at timestamptz not null default now()
);

create index if not exists auto_evaluations_session_id_idx on public.auto_evaluations (session_id);

alter table public.auto_evaluations enable row level security;

drop policy if exists "usuario ve sus autoevaluaciones" on public.auto_evaluations;
create policy "usuario ve sus autoevaluaciones" on public.auto_evaluations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
