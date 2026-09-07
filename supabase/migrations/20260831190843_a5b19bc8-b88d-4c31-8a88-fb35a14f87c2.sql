DROP POLICY IF EXISTS "properties_tenant_select" ON public.properties;

CREATE OR REPLACE FUNCTION public.is_property_tenant(_property_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = _property_id AND l.tenant_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_property_tenant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_property_tenant(uuid, uuid) TO authenticated;

CREATE POLICY "properties_tenant_select" ON public.properties
FOR SELECT TO authenticated
USING (public.is_property_tenant(id, auth.uid()));