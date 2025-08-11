-- Move vector extension to the extensions schema to satisfy linter
create schema if not exists extensions;
alter extension vector set schema extensions;

-- Ensure public functions have a fixed search_path
create or replace function public.validate_cage_status()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.status not in ('unprocessed', 'processed') then
    raise exception 'Invalid status: %. Must be unprocessed or processed', new.status;
  end if;
  return new;
end;
$function$;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.validate_cage_journey()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.journey not in ('first_mile', 'line_haul') then
    raise exception 'Invalid journey: %. Must be first_mile or line_haul', new.journey;
  end if;
  return new;
end;
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, first_name, last_name, login_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'login_code', '')
  );
  return new;
end;
$function$;