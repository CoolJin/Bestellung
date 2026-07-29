-- =====================================================================
-- SNS Bestellsystem - Schritt 2: Bestandsdaten übernehmen
-- =====================================================================
-- Überträgt die bisherigen Klartext-Accounts aus public.users nach
-- Supabase Auth (dort werden die Passwörter gehasht), holt Einstellungen
-- und Admin-Extras aus den missbrauchten orders-Zeilen heraus.
--
-- Erst ausführen, wenn 001 fehlerfrei durchgelaufen ist.
-- Nach erfolgreicher Kontrolle: 003_alte_tabellen_entfernen.sql
-- =====================================================================

-- pgcrypto liegt je nach Projekt in `extensions` oder `public` -
-- beide Schemata in den Suchpfad nehmen, damit crypt() gefunden wird.
set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- 1. Accounts nach auth.users
--    Login-E-Mail = benutzername@sns.local (nur intern, empfängt nichts).
-- ---------------------------------------------------------------------
insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
)
select
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    lower(u.username) || '@sns.local',
    crypt(u.password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', u.username),
    '', '', '', ''
from public.users u
where not exists (
    select 1 from auth.users a where a.email = lower(u.username) || '@sns.local'
);

-- Rolle, Flatrate und Warenkorb auf die frisch erzeugten Profile übertragen
-- (der Trigger aus 001 hat sie mit Standardwerten angelegt).
update public.profiles p
   set role     = case when u.role = 'admin' then 'admin' else 'user' end,
       is_pablo = coalesce(u.is_pablo, false),
       cart     = coalesce(u.cart, '[]'::jsonb)
  from public.users u
 where p.username = u.username;

-- ---------------------------------------------------------------------
-- 2. Einstellungen aus den #SETTINGS_-Zeilen
-- ---------------------------------------------------------------------
insert into public.settings (username, discord_id, notifications_enabled)
select
    replace(o.id, '#SETTINGS_', '')                                  as username,
    nullif(o.items->0->>'discordId', '')                             as discord_id,
    coalesce((o.items->0->>'notificationsEnabled')::boolean, true)   as notifications_enabled
from public.orders o
where o.id like '#SETTINGS_%'
  and jsonb_typeof(o.items) = 'array'
  and jsonb_array_length(o.items) > 0
on conflict (username) do update
    set discord_id            = excluded.discord_id,
        notifications_enabled = excluded.notifications_enabled;

-- ---------------------------------------------------------------------
-- 3. Admin-Extras aus der #ADMIN_EXTRAS-Zeile
-- ---------------------------------------------------------------------
update public.admin_extras
   set items      = coalesce((select o.items from public.orders o where o.id = '#ADMIN_EXTRAS'), '[]'::jsonb),
       updated_at = now()
 where id = 1;

-- ---------------------------------------------------------------------
-- 4. Die Pseudo-Bestellungen aus orders entfernen
-- ---------------------------------------------------------------------
delete from public.orders
 where id = '#ADMIN_EXTRAS' or id like '#SETTINGS_%';

-- ---------------------------------------------------------------------
-- 5. Kontrolle
-- ---------------------------------------------------------------------
do $$
declare
    alt int;
    neu int;
begin
    select count(*) into alt from public.users;
    select count(*) into neu from public.profiles;
    raise notice 'Alte users: %, neue profiles: %', alt, neu;
    if neu < alt then
        raise warning 'Es wurden weniger Profile angelegt als es Benutzer gab - bitte prüfen!';
    end if;
end $$;

-- Danach zur Kontrolle von Hand ausführen:
--   select username, role, is_pablo from public.profiles order by username;
-- und einmal mit einem echten Account in der App einloggen.
