CREATE POLICY "properties_tenant_select" ON public.properties
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    JOIN public.units u ON u.id = l.unit_id
    WHERE u.property_id = properties.id
      AND l.tenant_id = auth.uid()
  )
);