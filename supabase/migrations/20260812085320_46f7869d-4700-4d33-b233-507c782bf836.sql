DROP POLICY IF EXISTS properties_landlord_insert ON public.properties;

CREATE POLICY properties_landlord_insert
ON public.properties
FOR INSERT
TO authenticated
WITH CHECK (
  landlord_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);