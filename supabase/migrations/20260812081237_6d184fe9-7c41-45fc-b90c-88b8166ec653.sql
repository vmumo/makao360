
CREATE OR REPLACE FUNCTION public.market_estate_stats()
RETURNS TABLE(
  estate text, corridor text,
  properties bigint, units bigint, occupied bigint, vacant bigint,
  landlords bigint, tenants bigint,
  avg_rent numeric, monthly_rent bigint,
  small_landlords bigint, medium_landlords bigint, large_landlords bigint, institutional_landlords bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT pr.id, pr.landlord_id,
           NULLIF(split_part(pr.name, '— ', 2), '') AS est,
           COALESCE(pr.county, pr.city, 'Other') AS corr,
           COALESCE(pr.city, 'Nairobi') AS city
      FROM public.properties pr
  ),
  pe AS (SELECT id, landlord_id, COALESCE(est, city) AS estate, corr FROM p),
  u AS (
    SELECT pe.estate, pe.corr, pe.landlord_id, un.id AS unit_id, un.status, un.rent_amount
      FROM public.units un JOIN pe ON pe.id = un.property_id
  ),
  ll AS (
    SELECT landlord_id, count(*) AS unit_count FROM u GROUP BY landlord_id
  ),
  ll_est AS (
    SELECT DISTINCT estate, corr, landlord_id FROM u
  )
  SELECT
    u.estate, u.corr,
    (SELECT count(DISTINCT pe.id) FROM pe WHERE pe.estate = u.estate AND pe.corr = u.corr),
    count(*)::bigint,
    count(*) FILTER (WHERE u.status = 'occupied')::bigint,
    count(*) FILTER (WHERE u.status <> 'occupied')::bigint,
    count(DISTINCT u.landlord_id)::bigint,
    (SELECT count(DISTINCT l.tenant_id) FROM public.leases l
       WHERE l.status = 'active' AND l.unit_id IN (SELECT unit_id FROM u u2 WHERE u2.estate = u.estate AND u2.corr = u.corr))::bigint,
    ROUND(AVG(u.rent_amount))::numeric,
    SUM(u.rent_amount) FILTER (WHERE u.status = 'occupied')::bigint,
    (SELECT count(*) FROM ll_est e JOIN ll ON ll.landlord_id = e.landlord_id
       WHERE e.estate = u.estate AND e.corr = u.corr AND ll.unit_count BETWEEN 1 AND 8)::bigint,
    (SELECT count(*) FROM ll_est e JOIN ll ON ll.landlord_id = e.landlord_id
       WHERE e.estate = u.estate AND e.corr = u.corr AND ll.unit_count BETWEEN 9 AND 40)::bigint,
    (SELECT count(*) FROM ll_est e JOIN ll ON ll.landlord_id = e.landlord_id
       WHERE e.estate = u.estate AND e.corr = u.corr AND ll.unit_count BETWEEN 41 AND 100)::bigint,
    (SELECT count(*) FROM ll_est e JOIN ll ON ll.landlord_id = e.landlord_id
       WHERE e.estate = u.estate AND e.corr = u.corr AND ll.unit_count > 100)::bigint
  FROM u
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY u.estate, u.corr
  ORDER BY count(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.admin_landlord_directory(
  _corridor text DEFAULT NULL, _segment text DEFAULT NULL,
  _search text DEFAULT NULL, _limit int DEFAULT 200
)
RETURNS TABLE(
  landlord_id uuid, full_name text, phone text,
  corridors text[], estates text[],
  properties bigint, units bigint, occupied bigint, monthly_rent bigint, segment text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT pr.landlord_id,
           pr.id AS property_id,
           COALESCE(pr.county, pr.city, 'Other') AS corr,
           COALESCE(NULLIF(split_part(pr.name, '— ', 2), ''), pr.city, 'Other') AS est,
           un.id AS unit_id, un.status, un.rent_amount
      FROM public.properties pr
      LEFT JOIN public.units un ON un.property_id = pr.id
  ),
  agg AS (
    SELECT landlord_id,
           array_agg(DISTINCT corr) AS corridors,
           array_agg(DISTINCT est) AS estates,
           count(DISTINCT property_id)::bigint AS properties,
           count(unit_id)::bigint AS units,
           count(unit_id) FILTER (WHERE status = 'occupied')::bigint AS occupied,
           COALESCE(SUM(rent_amount) FILTER (WHERE status = 'occupied'),0)::bigint AS monthly_rent
      FROM base GROUP BY landlord_id
  )
  SELECT a.landlord_id, pf.full_name, pf.phone, a.corridors, a.estates,
         a.properties, a.units, a.occupied, a.monthly_rent,
         CASE WHEN a.units <= 8 THEN 'small'
              WHEN a.units <= 40 THEN 'medium'
              WHEN a.units <= 100 THEN 'large'
              ELSE 'institutional' END
    FROM agg a
    LEFT JOIN public.profiles pf ON pf.user_id = a.landlord_id
   WHERE public.has_role(auth.uid(), 'admin')
     AND (_corridor IS NULL OR _corridor = ANY(a.corridors))
     AND (_segment IS NULL OR _segment = CASE WHEN a.units <= 8 THEN 'small'
              WHEN a.units <= 40 THEN 'medium'
              WHEN a.units <= 100 THEN 'large' ELSE 'institutional' END)
     AND (_search IS NULL OR _search = '' OR pf.full_name ILIKE '%'||_search||'%' OR pf.phone ILIKE '%'||_search||'%')
   ORDER BY a.units DESC
   LIMIT GREATEST(LEAST(_limit, 1000), 1);
$$;

CREATE OR REPLACE FUNCTION public.admin_tenant_directory(
  _corridor text DEFAULT NULL, _estate text DEFAULT NULL,
  _search text DEFAULT NULL, _limit int DEFAULT 200
)
RETURNS TABLE(
  tenant_id uuid, full_name text, phone text,
  corridor text, estate text, property_name text, unit_label text,
  rent_amount int, lease_status lease_status, landlord_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.tenant_id, tp.full_name, tp.phone,
         COALESCE(pr.county, pr.city, 'Other'),
         COALESCE(NULLIF(split_part(pr.name, '— ', 2), ''), pr.city, 'Other'),
         pr.name, un.label, l.rent_amount, l.status, lp.full_name
    FROM public.leases l
    JOIN public.units un ON un.id = l.unit_id
    JOIN public.properties pr ON pr.id = un.property_id
    LEFT JOIN public.profiles tp ON tp.user_id = l.tenant_id
    LEFT JOIN public.profiles lp ON lp.user_id = l.landlord_id
   WHERE public.has_role(auth.uid(), 'admin')
     AND (_corridor IS NULL OR COALESCE(pr.county, pr.city, 'Other') = _corridor)
     AND (_estate IS NULL OR COALESCE(NULLIF(split_part(pr.name, '— ', 2), ''), pr.city, 'Other') = _estate)
     AND (_search IS NULL OR _search = '' OR tp.full_name ILIKE '%'||_search||'%' OR tp.phone ILIKE '%'||_search||'%' OR pr.name ILIKE '%'||_search||'%')
   ORDER BY l.created_at DESC
   LIMIT GREATEST(LEAST(_limit, 1000), 1);
$$;

CREATE OR REPLACE FUNCTION public.admin_properties_directory(
  _search text DEFAULT NULL, _corridor text DEFAULT NULL, _limit int DEFAULT 300
)
RETURNS TABLE(
  property_id uuid, name text, corridor text, estate text, city text,
  landlord_id uuid, landlord_name text,
  units bigint, occupied bigint, vacant bigint, monthly_rent bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pr.id, pr.name,
         COALESCE(pr.county, pr.city, 'Other'),
         COALESCE(NULLIF(split_part(pr.name, '— ', 2), ''), pr.city, 'Other'),
         pr.city, pr.landlord_id, pf.full_name,
         count(un.id)::bigint,
         count(un.id) FILTER (WHERE un.status = 'occupied')::bigint,
         count(un.id) FILTER (WHERE un.status <> 'occupied')::bigint,
         COALESCE(SUM(un.rent_amount) FILTER (WHERE un.status = 'occupied'),0)::bigint
    FROM public.properties pr
    LEFT JOIN public.units un ON un.property_id = pr.id
    LEFT JOIN public.profiles pf ON pf.user_id = pr.landlord_id
   WHERE public.has_role(auth.uid(), 'admin')
     AND (_corridor IS NULL OR COALESCE(pr.county, pr.city, 'Other') = _corridor)
     AND (_search IS NULL OR _search = '' OR pr.name ILIKE '%'||_search||'%' OR pf.full_name ILIKE '%'||_search||'%')
   GROUP BY pr.id, pr.name, pr.county, pr.city, pr.landlord_id, pf.full_name
   ORDER BY count(un.id) DESC
   LIMIT GREATEST(LEAST(_limit, 2000), 1);
$$;

GRANT EXECUTE ON FUNCTION public.market_estate_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_landlord_directory(text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tenant_directory(text, text, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_properties_directory(text, text, int) TO authenticated;
