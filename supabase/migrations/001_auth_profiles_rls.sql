-- =====================================================================
-- SNS Bestellsystem - Schritt 1: Supabase Auth, Profile, RLS
-- =====================================================================
-- Führe dieses Skript im Supabase SQL Editor aus (Dashboard > SQL Editor).
-- Es ist idempotent: mehrfaches Ausführen ist unschädlich.
--
-- WICHTIG: Vorher ein Backup anlegen (Dashboard > Database > Backups),
-- und in Authentication > Providers > Email die Option
-- "Confirm email" AUSSCHALTEN. Die Accounts benutzen synthetische
-- E-Mail-Adressen (benutzername@sns.local), an die keine Mail zustellbar ist.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Profile (Rolle, Flatrate, Warenkorb) - hängt an auth.users
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
    id          uuid primary key references auth.users(id) on delete cascade,
    username    text unique not null,
    role        text not null default 'user' check (role in ('user', 'admin')),
    is_pablo    boolean not null default false,
    cart        jsonb not null default '[]'::jsonb,
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Einstellungen (bisher als #SETTINGS_x-Zeilen in orders missbraucht)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
    username              text primary key,
    discord_id            text,
    notifications_enabled boolean not null default true,
    updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Admin-Extras (bisher die #ADMIN_EXTRAS-Zeile in orders)
-- ---------------------------------------------------------------------
create table if not exists public.admin_extras (
    id         int primary key default 1 check (id = 1),
    items      jsonb not null default '[]'::jsonb,
    updated_at timestamptz not null default now()
);
insert into public.admin_extras (id, items) values (1, '[]'::jsonb)
    on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Bestellnummern per Sequenz statt max()+1 im Browser
--    (verhindert doppelte IDs bei gleichzeitigen Bestellungen)
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq as bigint start with 1;

create or replace function public.next_order_id()
returns text
language sql
volatile
security definer
set search_path = public
as $$
    select '#' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

-- Sequenz auf den höchsten bereits vergebenen Wert setzen
do $$
declare
    max_id bigint;
begin
    select coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), '')::bigint), 0)
      into max_id
      from public.orders
     where id ~ '^#[0-9]+$';

    if max_id > 0 then
        perform setval('public.order_number_seq', max_id);
    end if;
exception
    when undefined_table then
        raise notice 'Tabelle orders existiert noch nicht - Sequenz bleibt bei 1.';
end $$;

-- ---------------------------------------------------------------------
-- 5. Hilfsfunktionen für die Policies
-- ---------------------------------------------------------------------
create or replace function public.current_username()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select username from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 6. Neue Accounts automatisch mit Profil versehen
--    Der Benutzername kommt aus den Metadaten des signUp-Aufrufs.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, username, role, is_pablo)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        'user',
        false
    )
    on conflict (id) do nothing;
    return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 7. Profile dürfen sich nicht selbst befördern
--    Nur Admins dürfen role / is_pablo / username ändern.
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if new.role is distinct from old.role
       or new.is_pablo is distinct from old.is_pablo
       or new.username is distinct from old.username
       or new.id is distinct from old.id then
        raise exception 'Nur Administratoren dürfen Rolle, Flatrate oder Benutzername ändern.';
    end if;

    return new;
end $$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
    before update on public.profiles
    for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- 8. Bestellungen: was ein normaler Nutzer ändern darf
--    - eigene offene Bestellung bearbeiten oder stornieren
--    - archivieren / aus der eigenen Liste entfernen
--    Alles andere (bestellt, bezahlt, Lager, Admin-Notiz) nur für Admins.
-- ---------------------------------------------------------------------
create or replace function public.guard_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
        raise exception 'Bestellung kann nicht umgehängt werden.';
    end if;

    -- Statuswechsel: nur offen -> storniert
    if new.status is distinct from old.status
       and not (old.status = 'open' and new.status = 'cancelled') then
        raise exception 'Diesen Status darf nur ein Administrator setzen.';
    end if;

    -- Inhalt/Summe nur solange die Bestellung offen ist
    if (new.items is distinct from old.items
        or new.total is distinct from old.total
        or new.note is distinct from old.note)
       and old.status <> 'open' then
        raise exception 'Nur offene Bestellungen können bearbeitet werden.';
    end if;

    -- Admin-Felder bleiben tabu
    if new.admin_note is distinct from old.admin_note
       or new.paid is distinct from old.paid
       or new.deleted_by_admin is distinct from old.deleted_by_admin
       or new.admin_archived is distinct from old.admin_archived then
        raise exception 'Dieses Feld darf nur ein Administrator ändern.';
    end if;

    return new;
end $$;

drop trigger if exists orders_guard_update on public.orders;
create trigger orders_guard_update
    before update on public.orders
    for each row execute function public.guard_order_update();

-- Frisch angelegte Bestellungen dürfen nicht schon "bezahlt" sein
create or replace function public.guard_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_admin() then
        return new;
    end if;

    if new.status not in ('open', 'request_open') then
        raise exception 'Neue Bestellungen starten als offen.';
    end if;

    new.paid             := false;
    new.admin_note       := '';
    new.deleted_by_admin := false;
    new.admin_archived   := false;
    return new;
end $$;

drop trigger if exists orders_guard_insert on public.orders;
create trigger orders_guard_insert
    before insert on public.orders
    for each row execute function public.guard_order_insert();

-- ---------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.settings     enable row level security;
alter table public.admin_extras enable row level security;
alter table public.orders       enable row level security;

-- Profile: eigenes lesen, Admins alle. Anlegen macht der Trigger.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
    for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
    for update using (id = auth.uid() or public.is_admin())
    with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
    for delete using (public.is_admin());

-- Einstellungen: nur die eigenen. Discord-IDs anderer bleiben privat,
-- auch vor Admins - die Benachrichtigungen verschickt die Datenbank (002).
drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings
    for all using (username = public.current_username())
    with check (username = public.current_username());

-- Extras: alle Angemeldeten lesen, nur Admins schreiben.
drop policy if exists admin_extras_select on public.admin_extras;
create policy admin_extras_select on public.admin_extras
    for select using (auth.uid() is not null);

drop policy if exists admin_extras_write on public.admin_extras;
create policy admin_extras_write on public.admin_extras
    for all using (public.is_admin()) with check (public.is_admin());

-- Bestellungen: eigene, Admins alle.
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
    for select using (user_id = public.current_username() or public.is_admin());

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
    for insert with check (user_id = public.current_username() or public.is_admin());

drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
    for update using (user_id = public.current_username() or public.is_admin())
    with check (user_id = public.current_username() or public.is_admin());

-- Löschen: eigene offene Anfragen zurückziehen, Admins alles.
drop policy if exists orders_delete on public.orders;
create policy orders_delete on public.orders
    for delete using (
        public.is_admin()
        or (user_id = public.current_username() and status = 'request_open')
    );

-- ---------------------------------------------------------------------
-- 10. Admin-Funktionen (Passwort setzen, Benutzer löschen)
--     Laufen als SECURITY DEFINER, prüfen aber selbst auf Adminrechte.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_password(target_username text, new_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    target_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Nur Administratoren dürfen Passwörter ändern.';
    end if;
    if length(coalesce(new_password, '')) < 8 then
        raise exception 'Das Passwort muss mindestens 8 Zeichen lang sein.';
    end if;

    select id into target_id from public.profiles where username = target_username;
    if target_id is null then
        raise exception 'Benutzer % existiert nicht.', target_username;
    end if;

    update auth.users
       set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
           updated_at = now()
     where id = target_id;
end $$;

create or replace function public.admin_delete_user(target_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    target_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Nur Administratoren dürfen Benutzer löschen.';
    end if;

    select id into target_id from public.profiles where username = target_username;
    if target_id is null then
        raise exception 'Benutzer % existiert nicht.', target_username;
    end if;
    if target_id = auth.uid() then
        raise exception 'Du kannst dich nicht selbst löschen.';
    end if;

    delete from public.settings where username = target_username;
    delete from auth.users where id = target_id;  -- profiles folgt per cascade
end $$;

revoke all on function public.admin_set_password(text, text) from public, anon;
revoke all on function public.admin_delete_user(text)        from public, anon;
grant execute on function public.admin_set_password(text, text) to authenticated;
grant execute on function public.admin_delete_user(text)        to authenticated;
grant execute on function public.next_order_id()                to authenticated;

-- ---------------------------------------------------------------------
-- 11. Anonymen Zugriff komplett entziehen
--     Ohne Login geht ab hier gar nichts mehr.
-- ---------------------------------------------------------------------
revoke all on public.profiles     from anon;
revoke all on public.settings     from anon;
revoke all on public.admin_extras from anon;
revoke all on public.orders       from anon;
