DROP POLICY IF EXISTS properties_landlord_insert ON public.properties;
CREATE POLICY properties_landlord_insert ON public.properties
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = landlord_id AND public.has_role(auth.uid(), 'landlord'::app_role))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS units_landlord_insert ON public.units;
CREATE POLICY units_landlord_insert ON public.units
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);