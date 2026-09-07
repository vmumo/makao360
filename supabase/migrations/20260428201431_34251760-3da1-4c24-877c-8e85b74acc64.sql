ALTER PUBLICATION supabase_realtime ADD TABLE public.units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_invites;
ALTER TABLE public.units REPLICA IDENTITY FULL;
ALTER TABLE public.leases REPLICA IDENTITY FULL;
ALTER TABLE public.tenant_invites REPLICA IDENTITY FULL;