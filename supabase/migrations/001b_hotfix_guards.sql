-- =====================================================================
-- SNS Bestellsystem - Hotfix zu 001
-- =====================================================================
-- Die Schutz-Trigger aus 001 haben auch direkte SQL-Zugriffe blockiert.
-- Im SQL Editor gibt es keine angemeldete Session, also ist auth.uid()
-- leer - der Trigger hielt das für einen normalen Nutzer und verweigerte
-- die Änderung. Dadurch scheiterte 002 mit:
--
--   Nur Administratoren dürfen Rolle, Flatrate oder Benutzername ändern.
--
-- Zugriffe ohne Session kommen nur aus dem Dashboard, aus Migrationen oder
-- vom service_role-Key - alle drei sind ohnehin privilegiert. Über die App
-- ist ein Zugriff ohne Session unmöglich: dort greifen zusätzlich die
-- RLS-Policies, und für `anon` wurden sämtliche Rechte entzogen.
--
-- Dieses Skript ersetzt nur die drei Funktionen. 001 muss nicht erneut
-- ausgeführt werden. Danach 002 (neu) starten.
-- =====================================================================

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or public.is_admin() then
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

create or replace function public.guard_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or public.is_admin() then
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

create or replace function public.guard_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null or public.is_admin() then
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
