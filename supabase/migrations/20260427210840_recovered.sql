
-- Re-create with explicit search_path and lock down execute privileges

-- has_role: keep callable so RLS uses it via SECURITY DEFINER, but only via authenticated context
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke execute on function public.current_user_has_role(public.app_role) from public, anon;
grant execute on function public.current_user_has_role(public.app_role) to authenticated, service_role;

-- internal triggers: revoke from everyone (only triggers invoke them)
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.recompute_cycle_totals() from public, anon, authenticated;

-- Ensure search_path is fixed on the trigger function (was missing)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

;
