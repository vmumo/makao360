CREATE OR REPLACE FUNCTION public.admin_ledger_consistency()
 RETURNS TABLE(lease_id uuid, tenant_id uuid, landlord_id uuid, expected_balance bigint, ledger_balance bigint, drift bigint, contributions_total bigint, payouts_total bigint, last_ledger_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN QUERY
  WITH contrib AS (
    SELECT c.lease_id AS lid, COALESCE(SUM(c.amount),0)::bigint AS total
      FROM public.contributions c WHERE c.status = 'success' GROUP BY c.lease_id
  ),
  pay AS (
    SELECT p.lease_id AS lid, COALESCE(SUM(p.amount),0)::bigint AS total
      FROM public.payouts p WHERE p.status = 'paid' GROUP BY p.lease_id
  ),
  led AS (
    SELECT DISTINCT ON (e.lease_id) e.lease_id AS lid, e.balance_after::bigint AS bal, e.created_at
      FROM public.ledger_entries e
      ORDER BY e.lease_id, e.created_at DESC
  )
  SELECT
    l.id,
    l.tenant_id,
    l.landlord_id,
    (COALESCE(c.total,0) - COALESCE(p.total,0))::bigint,
    COALESCE(led.bal, 0)::bigint,
    (COALESCE(led.bal,0) - (COALESCE(c.total,0) - COALESCE(p.total,0)))::bigint,
    COALESCE(c.total,0)::bigint,
    COALESCE(p.total,0)::bigint,
    led.created_at
  FROM public.leases l
  LEFT JOIN contrib c ON c.lid = l.id
  LEFT JOIN pay p ON p.lid = l.id
  LEFT JOIN led ON led.lid = l.id
  WHERE COALESCE(led.bal,0) <> (COALESCE(c.total,0) - COALESCE(p.total,0))
  ORDER BY ABS(COALESCE(led.bal,0) - (COALESCE(c.total,0) - COALESCE(p.total,0))) DESC
  LIMIT 500;
END;
$function$;