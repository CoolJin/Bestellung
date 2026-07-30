-- =====================================================================
-- SNS Bestellsystem - Schritt 5: Passwörter im Adminbereich einsehbar
-- =====================================================================
-- Auf Wunsch: Admins sollen im Nutzerpanel per Auge-Symbol das Passwort
-- eines Benutzers sehen können.
--
-- Der Login läuft weiterhin über den bcrypt-Hash in auth.users. Diese
-- Tabelle ist eine zusätzliche Klartext-Kopie, ausschließlich zur Anzeige.
--
-- WICHTIG - was das bedeutet:
--   * Bereits vorhandene Passwörter tauchen hier NICHT auf. Sie liegen nur
--     als Hash vor und lassen sich nicht zurückrechnen. Erst wenn ein
--     Passwort neu gesetzt wird, ist es sichtbar.
--   * Wer Zugriff auf diese Tabelle bekommt, liest echte Passwörter -
--     und viele Menschen benutzen dasselbe Passwort mehrfach. Deshalb
--     liegt sie in einer eigenen Tabelle, die per RLS nur für Admins
--     lesbar ist. Normale Nutzer kommen nicht heran.
-- =====================================================================

create table if not exists public.user_secrets (
    username   text primary key
               references public.profiles(username) on update cascade on delete cascade,
    password   text not null,
    updated_at timestamptz not null default now()
);

alter table public.user_secrets enable row level security;

-- Nur Admins - für alle anderen existiert die Tabelle praktisch nicht.
drop policy if exists user_secrets_admin_only on public.user_secrets;
create policy user_secrets_admin_only on public.user_secrets
    for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.user_secrets from anon;
grant select, insert, update, delete on public.user_secrets to authenticated;

-- ---------------------------------------------------------------------
-- Passwort setzen schreibt die Klartext-Kopie gleich mit
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
       set encrypted_password = crypt(new_password, gen_salt('bf')),
           updated_at = now()
     where id = target_id;

    insert into public.user_secrets (username, password, updated_at)
    values (target_username, new_password, now())
    on conflict (username) do update
        set password   = excluded.password,
            updated_at = excluded.updated_at;
end $$;

revoke all on function public.admin_set_password(text, text) from public, anon;
grant execute on function public.admin_set_password(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Beim Löschen eines Benutzers verschwindet die Kopie mit
-- (das erledigt bereits das on delete cascade oben, hier nur zur
--  Sicherheit für den Fall, dass die Reihenfolge anders läuft)
-- ---------------------------------------------------------------------
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

    delete from public.user_secrets where username = target_username;
    delete from public.settings     where username = target_username;
    delete from auth.users where id = target_id;  -- profiles folgt per cascade
end $$;

revoke all on function public.admin_delete_user(text) from public, anon;
grant execute on function public.admin_delete_user(text) to authenticated;
