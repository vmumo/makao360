import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type VacantUnit = {
  id: string;
  label: string;
  rent_amount: number;
  deposit_amount: number;
  properties: { name: string; landlord_id: string };
};

/**
 * Shared selector for the current landlord's vacant units.
 * Auto-refreshes via Supabase realtime when units, leases, or
 * tenant_invites change so the Invite tenant button stays accurate
 * without a page reload.
 */
export function useVacantUnits(options?: { allLandlords?: boolean }) {
  const all = options?.allLandlords ?? false;
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["vacant-units", user?.id, all],
    enabled: !!user,
    queryFn: async (): Promise<VacantUnit[]> => {
      let q = supabase
        .from("units")
        .select(
          "id, label, rent_amount, deposit_amount, properties!inner(name, landlord_id)",
        );
      if (!all) q = q.eq("properties.landlord_id", user!.id);
      const { data, error } = await q
        .eq("status", "vacant")
        .order("label", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as VacantUnit[];
    },
    staleTime: 15_000,
  });

  // Realtime: invalidate whenever a unit, lease, or invite changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`vacant-units-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "units" }, () => {
        void qc.invalidateQueries({ queryKey: ["vacant-units"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "leases" }, () => {
        void qc.invalidateQueries({ queryKey: ["vacant-units"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tenant_invites" }, () => {
        void qc.invalidateQueries({ queryKey: ["vacant-units"] });
        void qc.invalidateQueries({ queryKey: ["invites"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  return {
    ...query,
    units: query.data ?? [],
    count: query.data?.length ?? 0,
    hasVacancy: (query.data?.length ?? 0) > 0,
  };
}
