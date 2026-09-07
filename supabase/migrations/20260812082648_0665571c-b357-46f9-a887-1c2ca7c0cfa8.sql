ALTER TABLE public.rent_advances
  ADD CONSTRAINT rent_advances_lease_id_fkey
  FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;

ALTER TABLE public.fuliza_applications
  ADD CONSTRAINT fuliza_applications_lease_id_fkey
  FOREIGN KEY (lease_id) REFERENCES public.leases(id) ON DELETE CASCADE;