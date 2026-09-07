
-- Add geo columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

CREATE INDEX IF NOT EXISTS properties_latlng_idx
  ON public.properties(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Backfill approximate coordinates from city name with jitter (~2km spread)
WITH centroids(city, lat, lng) AS (VALUES
  ('Nairobi'::text, -1.2921::float8, 36.8219::float8),
  ('Mombasa', -4.0435, 39.6682),
  ('Kisumu', -0.0917, 34.7680),
  ('Nakuru', -0.3031, 36.0800),
  ('Eldoret', 0.5143, 35.2698),
  ('Thika', -1.0333, 37.0693),
  ('Kiambu', -1.1714, 36.8356),
  ('Naivasha', -0.7167, 36.4333),
  ('Machakos', -1.5177, 37.2634),
  ('Nyeri', -0.4200, 36.9500),
  ('Ruiru', -1.1450, 36.9614),
  ('Tudor', -4.0333, 39.6500)
)
UPDATE public.properties p
SET latitude  = c.lat + (random() - 0.5) * 0.04,
    longitude = c.lng + (random() - 0.5) * 0.04
FROM centroids c
WHERE p.city = c.city
  AND p.latitude IS NULL;

-- Any remaining rows default to Nairobi with wider jitter
UPDATE public.properties
SET latitude  = -1.2921 + (random() - 0.5) * 0.1,
    longitude = 36.8219 + (random() - 0.5) * 0.1
WHERE latitude IS NULL;

-- Aggregated metrics per landlord (for map + analytics)
CREATE OR REPLACE FUNCTION public.landlord_property_map(_landlord_id uuid DEFAULT NULL)
RETURNS TABLE (
  property_id uuid,
  landlord_id uuid,
  name text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  portfolio_id uuid,
  units_total bigint,
  units_occupied bigint,
  units_vacant bigint,
  arrears_total bigint,
  revenue_30d bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id, p.landlord_id, p.name, p.city, p.address,
    p.latitude, p.longitude, p.portfolio_id,
    COALESCE(u.units_total, 0),
    COALESCE(u.units_occupied, 0),
    COALESCE(u.units_total, 0) - COALESCE(u.units_occupied, 0),
    COALESCE(arr.arrears_total, 0),
    COALESCE(rev.revenue_30d, 0)
  FROM public.properties p
  LEFT JOIN (
    SELECT property_id,
           count(*) AS units_total,
           count(*) FILTER (WHERE status = 'occupied') AS units_occupied
    FROM public.units GROUP BY property_id
  ) u ON u.property_id = p.id
  LEFT JOIN (
    SELECT un.property_id,
           SUM(GREATEST(0, l.rent_amount - COALESCE(paid.amt, 0)))::bigint AS arrears_total
    FROM public.leases l
    JOIN public.units un ON un.id = l.unit_id
    LEFT JOIN (
      SELECT lease_id, SUM(amount)::bigint AS amt
      FROM public.contributions
      WHERE status = 'success'
        AND created_at >= date_trunc('month', now())
      GROUP BY lease_id
    ) paid ON paid.lease_id = l.id
    WHERE l.status = 'active'
    GROUP BY un.property_id
  ) arr ON arr.property_id = p.id
  LEFT JOIN (
    SELECT un.property_id, SUM(c.amount)::bigint AS revenue_30d
    FROM public.contributions c
    JOIN public.leases l ON l.id = c.lease_id
    JOIN public.units un ON un.id = l.unit_id
    WHERE c.status = 'success'
      AND c.created_at >= now() - interval '30 days'
    GROUP BY un.property_id
  ) rev ON rev.property_id = p.id
  WHERE
    (has_role(auth.uid(), 'admin'))
    OR (_landlord_id IS NULL AND p.landlord_id = auth.uid())
    OR (_landlord_id IS NOT NULL AND p.landlord_id = _landlord_id
        AND (p.landlord_id = auth.uid() OR has_role(auth.uid(), 'admin')));
$$;

GRANT EXECUTE ON FUNCTION public.landlord_property_map(uuid) TO authenticated;
