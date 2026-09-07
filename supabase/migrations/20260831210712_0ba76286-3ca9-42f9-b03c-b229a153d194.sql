ALTER TABLE public.landlord_tax_settings
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_email text,
  ADD COLUMN IF NOT EXISTS business_phone text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS invoice_footer text;

CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_meta jsonb := '{}'::jsonb;
  k text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  FOREACH k IN ARRAY ARRAY['status','amount','rent_amount','label','name','role','category','title','invoice_number','property_id','unit_id','lease_id','landlord_id','tenant_id']
  LOOP
    IF v_row ? k THEN
      v_meta := v_meta || jsonb_build_object(k, v_row -> k);
    END IF;
  END LOOP;

  INSERT INTO public.audit_log (actor_id, action, entity_table, entity_id, meta)
  VALUES (
    auth.uid(),
    TG_ARGV[0] || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    NULLIF(v_row ->> 'id', '')::uuid,
    v_meta || jsonb_build_object('op', TG_OP)
  );
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_audit_row() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_properties ON public.properties;
CREATE TRIGGER audit_properties AFTER INSERT OR UPDATE OR DELETE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('property');

DROP TRIGGER IF EXISTS audit_units ON public.units;
CREATE TRIGGER audit_units AFTER INSERT OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('unit');

DROP TRIGGER IF EXISTS audit_leases ON public.leases;
CREATE TRIGGER audit_leases AFTER INSERT OR UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('lease');

DROP TRIGGER IF EXISTS audit_contributions ON public.contributions;
CREATE TRIGGER audit_contributions AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('payment');

DROP TRIGGER IF EXISTS audit_payouts ON public.payouts;
CREATE TRIGGER audit_payouts AFTER INSERT OR UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('payout');

DROP TRIGGER IF EXISTS audit_expenses ON public.expenses;
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('expense');

DROP TRIGGER IF EXISTS audit_maintenance ON public.maintenance_requests;
CREATE TRIGGER audit_maintenance AFTER INSERT OR UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('maintenance');

DROP TRIGGER IF EXISTS audit_invites ON public.tenant_invites;
CREATE TRIGGER audit_invites AFTER INSERT OR UPDATE ON public.tenant_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('tenant_invite');

DROP TRIGGER IF EXISTS audit_roles ON public.user_roles;
CREATE TRIGGER audit_roles AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('role');

DROP TRIGGER IF EXISTS audit_applications ON public.rental_applications;
CREATE TRIGGER audit_applications AFTER INSERT OR UPDATE ON public.rental_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('application');

DROP TRIGGER IF EXISTS audit_lease_documents ON public.lease_documents;
CREATE TRIGGER audit_lease_documents AFTER INSERT OR UPDATE ON public.lease_documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row('lease_document');