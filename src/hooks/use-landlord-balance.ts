import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LandlordBalance = {
  matchedIn: number;
  paidOut: number;
  balance: number;
  unmatchedCount: number;
  unmatchedTotal: number;
};

/**
 * Live bank ledger balance for a landlord:
 * matched statement credits minus settled payouts.
 */
export function useLandlordBalance(landlordId: string | null) {
  return useQuery<LandlordBalance>({
    queryKey: ["landlord-balance", landlordId],
    enabled: !!landlordId,
    queryFn: async () => {
      const [txns, payouts] = await Promise.all([
        supabase
          .from("bank_transactions")
          .select("amount, status")
          .eq("landlord_id", landlordId!),
        supabase
          .from("payouts")
          .select("amount, status")
          .eq("landlord_id", landlordId!),
      ]);
      if (txns.error) throw txns.error;
      if (payouts.error) throw payouts.error;

      const matchedIn = (txns.data ?? [])
        .filter((t) => t.status === "matched")
        .reduce((s, t) => s + Number(t.amount), 0);
      const unmatched = (txns.data ?? []).filter((t) => t.status === "unmatched");
      const paidOut = (payouts.data ?? [])
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + Number(p.amount), 0);

      return {
        matchedIn,
        paidOut,
        balance: matchedIn - paidOut,
        unmatchedCount: unmatched.length,
        unmatchedTotal: unmatched.reduce((s, t) => s + Number(t.amount), 0),
      };
    },
  });
}
