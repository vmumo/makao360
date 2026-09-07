ALTER TABLE public.leases
  ADD CONSTRAINT leases_tenant_profile_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_tenant_profile_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_tenant_profile_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

CREATE POLICY "profiles_landlord_view_tenants"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.tenant_id = profiles.user_id
      AND l.landlord_id = auth.uid()
  )
);