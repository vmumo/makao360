DROP POLICY IF EXISTS threads_participants_select ON public.message_threads;
CREATE POLICY threads_participants_select ON public.message_threads FOR SELECT TO authenticated
USING (
  landlord_id = auth.uid()
  OR tenant_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.landlord_team_members m
    WHERE m.landlord_id = message_threads.landlord_id
      AND m.member_user_id = auth.uid()
      AND m.status = 'active'
      AND (cardinality(m.property_ids) = 0 OR message_threads.property_id = ANY (m.property_ids))
  )
);

DROP POLICY IF EXISTS threads_participants_update ON public.message_threads;
CREATE POLICY threads_participants_update ON public.message_threads FOR UPDATE TO authenticated
USING (
  landlord_id = auth.uid() OR tenant_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  landlord_id = auth.uid() OR tenant_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS threads_participants_delete ON public.message_threads;
CREATE POLICY threads_participants_delete ON public.message_threads FOR DELETE TO authenticated
USING (landlord_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
GRANT DELETE ON public.message_threads TO authenticated;