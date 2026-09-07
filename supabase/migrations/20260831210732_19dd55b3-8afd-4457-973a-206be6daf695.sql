CREATE POLICY tax_settings_tenant_read ON public.landlord_tax_settings
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leases l
    WHERE l.landlord_id = landlord_tax_settings.landlord_id
      AND l.tenant_id = auth.uid()
  )
);