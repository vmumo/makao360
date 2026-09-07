CREATE OR REPLACE FUNCTION public.guard_profile_kyc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  -- Service role / background jobs (no auth.uid()) and admins may change it.
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  new.kyc_status := old.kyc_status;
  return new;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_kyc_status() FROM authenticated, anon, public;

DROP TRIGGER IF EXISTS trg_profiles_guard_kyc ON public.profiles;
CREATE TRIGGER trg_profiles_guard_kyc
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_kyc_status();