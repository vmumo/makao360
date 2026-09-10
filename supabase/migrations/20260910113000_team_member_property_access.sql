-- QA finding (10 Sep 2026): active team members scoped to a property could
-- read its message_threads (threads_participants_select has a team clause)
-- but not the property or its units, leaving scoped caretakers blind to
-- their assigned properties. Add SELECT policies mirroring the exact
-- team-membership semantics used by threads_participants_select:
-- active membership, empty property_ids = all of the landlord's properties.

CREATE POLICY properties_team_select ON public.properties
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.landlord_team_members m
  WHERE m.landlord_id = properties.landlord_id
    AND m.member_user_id = auth.uid()
    AND m.status = 'active'::public.team_member_status
    AND (cardinality(m.property_ids) = 0 OR properties.id = ANY (m.property_ids))
));

CREATE POLICY units_team_select ON public.units
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.properties p
  JOIN public.landlord_team_members m ON m.landlord_id = p.landlord_id
  WHERE p.id = units.property_id
    AND m.member_user_id = auth.uid()
    AND m.status = 'active'::public.team_member_status
    AND (cardinality(m.property_ids) = 0 OR p.id = ANY (m.property_ids))
));

-- Support the membership lookup in the new predicates.
CREATE INDEX IF NOT EXISTS idx_team_members_member
  ON public.landlord_team_members (member_user_id);
