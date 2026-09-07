import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LandlordBusinessProfile = {
  landlord_id: string;
  business_name: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  invoice_footer: string | null;
  kra_pin: string | null;
  payout_bank_name: string | null;
  payout_account: string | null;
  payout_phone: string | null;
  management_fee_rate: number;
  wht_rate: number;
  vat_registered: boolean;
};

/** Business/bank details of a landlord. Readable by the landlord, their tenants and admins. */
export function useLandlordProfile(landlordId?: string | null) {
  return useQuery({
    queryKey: ["landlord-business-profile", landlordId],
    enabled: !!landlordId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landlord_tax_settings")
        .select("*")
        .eq("landlord_id", landlordId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LandlordBusinessProfile | null;
    },
  });
}

export function payToLine(p?: LandlordBusinessProfile | null) {
  if (!p) return null;
  const parts: string[] = [];
  if (p.payout_bank_name || p.payout_account) {
    parts.push([p.payout_bank_name, p.payout_account].filter(Boolean).join(" · "));
  }
  if (p.payout_phone) parts.push(`M-Pesa ${p.payout_phone}`);
  return parts.length ? parts.join(" | ") : null;
}
