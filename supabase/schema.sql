-- =====================================================================
-- FantaTrentesimo — script completo per Supabase
-- Incollalo in: Supabase → SQL Editor → New query → Run
-- Si può rieseguire senza problemi (non cancella i dati esistenti).
-- =====================================================================

-- ⚠️ PIN ADMIN: la prima esecuzione crea il PIN provvisorio '3030'.
-- Cambialo SUBITO con una query a parte (non salvarla in questo file, la repo è pubblica):
--     update admin_config set pin = 'IL-TUO-PIN' where id = 1;
-- =====================================================================


-- ---------- TABELLE ----------
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  festeggiato text not null default 'Martina',
  titolo text not null default 'FantaTrentesimo',
  classifica_visibile boolean not null default true
);

create table if not exists admin_config (
  id int primary key default 1 check (id = 1),
  pin text not null
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  avatar text not null default '😎',
  created_at timestamptz not null default now()
);
create unique index if not exists guests_nome_unique on guests (lower(trim(nome)));

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  emoji text not null default '🎉',
  nome text not null,
  descrizione text not null default '',
  punti int not null,
  created_at timestamptz not null default now()
);

create table if not exists point_events (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references guests(id) on delete cascade,
  rule_id uuid references rules(id) on delete set null,
  nome text not null,            -- copia del nome dell'azione (resta anche se la regola viene eliminata)
  emoji text not null,
  punti int not null,
  nota text not null default '',
  annullato boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists point_events_guest_idx on point_events (guest_id);


-- ---------- DATI INIZIALI ----------
insert into settings (id) values (1) on conflict (id) do nothing;

insert into admin_config (id, pin) values (1, '3030')
  on conflict (id) do nothing;   -- non sovrascrive un PIN già cambiato

insert into rules (emoji, nome, descrizione, punti)
select * from (values
  ('💃', 'Primo a ballare',     'Rompe il ghiaccio in pista',              10),
  ('🥂', 'Brindisi commosso',   'Discorso con lacrimuccia inclusa',        15),
  ('🎤', 'Discorso epico',      'Prende la parola davanti a tutti',        20),
  ('📸', 'Selfie con Martina',  'Foto ricordo con la festeggiata',          5),
  ('🎂', 'Voce da stadio',      'Canta “Tanti auguri” più forte di tutti', 10),
  ('🍝', 'Scarpetta',           'Il piatto torna in cucina lucido',         5),
  ('🍷', 'Rovescia un drink',   'Tovaglia vittima innocente',              -5),
  ('⏰', 'Ritardatario',        'Arriva dopo l’antipasto',                -10),
  ('📱', 'Telefono a tavola',   'Beccato a scrollare',                     -5),
  ('👴', 'Battuta sull’età',    '“Eh, 30 anni… ormai sei vecchia”',       -10)
) as v(emoji, nome, descrizione, punti)
where not exists (select 1 from rules);


-- ---------- SICUREZZA (RLS) ----------
-- Tutti possono LEGGERE; nessuno può scrivere direttamente.
-- Le scritture passano solo dalle funzioni admin_* qui sotto, che controllano il PIN.
alter table settings     enable row level security;
alter table admin_config enable row level security;
alter table guests       enable row level security;
alter table rules        enable row level security;
alter table point_events enable row level security;

drop policy if exists "lettura pubblica" on settings;
drop policy if exists "lettura pubblica" on guests;
drop policy if exists "lettura pubblica" on rules;
drop policy if exists "lettura pubblica" on point_events;
create policy "lettura pubblica" on settings     for select using (true);
create policy "lettura pubblica" on guests       for select using (true);
create policy "lettura pubblica" on rules        for select using (true);
create policy "lettura pubblica" on point_events for select using (true);
-- admin_config: nessuna policy → il PIN non è leggibile da fuori
revoke all on admin_config from anon, authenticated;


-- ---------- FUNZIONI ADMIN ----------
create or replace function _check_pin(p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_config where pin = p_pin) then
    raise exception 'PIN errato';
  end if;
end $$;
revoke execute on function _check_pin(text) from public, anon, authenticated;

create or replace function admin_login(p_pin text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from admin_config where pin = p_pin);
$$;

create or replace function admin_assign(p_pin text, p_guest_ids uuid[], p_rule_id uuid default null, p_punti int default null, p_nota text default '')
returns uuid[] language plpgsql security definer set search_path = public as $$
declare r rules%rowtype; v_ids uuid[];
begin
  perform _check_pin(p_pin);
  if p_rule_id is not null then
    select * into r from rules where id = p_rule_id;
    if not found then raise exception 'Regola non trovata'; end if;
    with ins as (
      insert into point_events (guest_id, rule_id, nome, emoji, punti, nota)
      select g, r.id, r.nome, r.emoji, r.punti, coalesce(p_nota, '') from unnest(p_guest_ids) g
      returning id
    ) select array_agg(ins.id) into v_ids from ins;
  else
    if coalesce(p_punti, 0) = 0 then raise exception 'Punti non validi'; end if;
    with ins as (
      insert into point_events (guest_id, rule_id, nome, emoji, punti, nota)
      select g, null, 'Punti extra', '✨', p_punti, coalesce(p_nota, '') from unnest(p_guest_ids) g
      returning id
    ) select array_agg(ins.id) into v_ids from ins;
  end if;
  return v_ids;
end $$;

create or replace function admin_set_annullato(p_pin text, p_ids uuid[], p_annullato boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  update point_events set annullato = p_annullato where id = any(p_ids);
end $$;

create or replace function admin_save_rule(p_pin text, p_id uuid, p_emoji text, p_nome text, p_descrizione text, p_punti int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  if p_id is null then
    insert into rules (emoji, nome, descrizione, punti) values (p_emoji, trim(p_nome), coalesce(trim(p_descrizione), ''), p_punti);
  else
    update rules set emoji = p_emoji, nome = trim(p_nome), descrizione = coalesce(trim(p_descrizione), ''), punti = p_punti where id = p_id;
  end if;
end $$;

create or replace function admin_delete_rule(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  delete from rules where id = p_id;
end $$;

create or replace function admin_save_guest(p_pin text, p_id uuid, p_nome text, p_avatar text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  if p_id is null then
    insert into guests (nome, avatar) values (trim(p_nome), p_avatar);
  else
    update guests set nome = trim(p_nome), avatar = p_avatar where id = p_id;
  end if;
exception when unique_violation then
  raise exception 'Esiste già un invitato con questo nome.';
end $$;

create or replace function admin_delete_guest(p_pin text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  delete from guests where id = p_id;   -- i suoi punti si cancellano a cascata
end $$;

create or replace function admin_save_settings(p_pin text, p_festeggiato text default null, p_titolo text default null, p_classifica_visibile boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  update settings set
    festeggiato = coalesce(trim(p_festeggiato), festeggiato),
    titolo = coalesce(trim(p_titolo), titolo),
    classifica_visibile = coalesce(p_classifica_visibile, classifica_visibile)
  where id = 1;
end $$;

create or replace function admin_reset_points(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  delete from point_events where true;
end $$;

create or replace function admin_reset_all(p_pin text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _check_pin(p_pin);
  delete from point_events where true;
  delete from guests where true;
end $$;


-- ---------- TEMPO REALE ----------
do $$
declare t text;
begin
  foreach t in array array['settings', 'guests', 'rules', 'point_events'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
