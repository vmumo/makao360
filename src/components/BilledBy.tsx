import { Building2 } from "lucide-react";
import { useLandlordProfile, payToLine } from "@/hooks/use-landlord-profile";

type Props = { landlordId: string; fallbackName?: string | null };

/** Shows the landlord's business + pay-to details on invoices and payment screens. */
export function BilledBy({ landlordId, fallbackName }: Props) {
  const { data } = useLandlordProfile(landlordId);
  const name = data?.business_name || fallbackName;
  const payTo = payToLine(data);
  if (!name && !payTo && !data?.business_address) return null;

  return (
    <div className="mb-6 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="size-4" /> Billed by {name ?? "your landlord"}
      </div>
      <div className="mt-1.5 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {data?.business_address && <span>{data.business_address}</span>}
        {data?.kra_pin && <span>KRA PIN: {data.kra_pin}</span>}
        {(data?.business_email || data?.business_phone) && (
          <span>{[data.business_email, data.business_phone].filter(Boolean).join(" · ")}</span>
        )}
        {payTo && <span className="font-medium text-foreground">Pay to: {payTo}</span>}
      </div>
      {data?.invoice_footer && <p className="mt-2 text-xs text-muted-foreground">{data.invoice_footer}</p>}
    </div>
  );
}
