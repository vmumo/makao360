-- Lease renewals: tenants may only change status / response_note / responded_at
CREATE OR REPLACE FUNCTION public.guard_lease_renewal_tenant_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if auth.uid() is null or auth.uid() = old.landlord_id or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if auth.uid() = old.tenant_id then
    new.lease_id := old.lease_id;
    new.landlord_id := old.landlord_id;
    new.tenant_id := old.tenant_id;
    new.current_rent := old.current_rent;
    new.new_rent := old.new_rent;
    new.new_end_date := old.new_end_date;
    new.message := old.message;
  end if;
  return new;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_lease_renewal_tenant_update() FROM authenticated, anon, public;
DROP TRIGGER IF EXISTS trg_lease_renewals_tenant_guard ON public.lease_renewals;
CREATE TRIGGER trg_lease_renewals_tenant_guard
  BEFORE UPDATE ON public.lease_renewals
  FOR EACH ROW EXECUTE FUNCTION public.guard_lease_renewal_tenant_update();

-- Lease documents: tenants may only add their own signature
CREATE OR REPLACE FUNCTION public.guard_lease_document_tenant_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if auth.uid() is null or auth.uid() = old.landlord_id or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if auth.uid() = old.tenant_id then
    new.lease_id := old.lease_id;
    new.landlord_id := old.landlord_id;
    new.tenant_id := old.tenant_id;
    new.title := old.title;
    new.body := old.body;
    new.landlord_signature := old.landlord_signature;
    new.landlord_signed_at := old.landlord_signed_at;
    new.sent_at := old.sent_at;
    -- tenant may only move the document to 'signed'
    if new.status is distinct from old.status and new.status <> 'signed' then
      new.status := old.status;
    end if;
    if new.tenant_signature is not null and old.tenant_signature is null then
      new.tenant_signed_at := coalesce(new.tenant_signed_at, now());
    end if;
  end if;
  return new;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_lease_document_tenant_update() FROM authenticated, anon, public;
DROP TRIGGER IF EXISTS trg_lease_documents_tenant_guard ON public.lease_documents;
CREATE TRIGGER trg_lease_documents_tenant_guard
  BEFORE UPDATE ON public.lease_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_lease_document_tenant_update();

-- Maintenance requests: tenants may not change landlord-controlled fields
CREATE OR REPLACE FUNCTION public.guard_maintenance_tenant_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if auth.uid() is null or auth.uid() = old.landlord_id or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;
  if auth.uid() = old.tenant_id then
    new.tenant_id := old.tenant_id;
    new.landlord_id := old.landlord_id;
    new.unit_id := old.unit_id;
    new.property_id := old.property_id;
    new.status := old.status;
    new.landlord_note := old.landlord_note;
    new.resolved_at := old.resolved_at;
  end if;
  return new;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_maintenance_tenant_update() FROM authenticated, anon, public;
DROP TRIGGER IF EXISTS trg_maintenance_tenant_guard ON public.maintenance_requests;
CREATE TRIGGER trg_maintenance_tenant_guard
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_maintenance_tenant_update();