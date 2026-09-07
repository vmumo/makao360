DROP POLICY IF EXISTS invites_landlord_all ON public.tenant_invites;

CREATE POLICY invites_landlord_all
ON public.tenant_invites
FOR ALL
TO authenticated
USING (
  (SELECT auth.uid()) = landlord_id
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
)
WITH CHECK (
  (SELECT auth.uid()) = landlord_id
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);