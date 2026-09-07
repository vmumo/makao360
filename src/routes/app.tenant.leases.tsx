import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { formatKES, formatDate } from "@/lib/format";
import { ArrowRight, FileText } from "lucide-react";

export const Route = createFileRoute("/app/tenant/leases")({
  component: TenantLeases,
});

function TenantLeases() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["tenant-lease-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("*, units(label, properties(name, address))")
        .eq("tenant_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <PageHeader title="My leases" description="View statements per cycle and download receipts." />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <FileText className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No leases yet</h3>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.map((l) => {
            const u = l.units as { label: string; properties: { name: string; address: string | null } | null } | null;
            return (
              <Link key={l.id} to="/app/tenant/leases/$leaseId" params={{ leaseId: l.id }}
                    className="rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-card transition">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display font-semibold">{u?.properties?.name ?? "Property"}</div>
                    <div className="text-sm text-muted-foreground">Unit {u?.label ?? "—"}</div>
                  </div>
                  <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">
                    {l.status}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Mini label="Rent" value={formatKES(l.rent_amount)} />
                  <Mini label="Started" value={formatDate(l.start_date)} />
                </div>
                <div className="mt-4 text-sm text-primary inline-flex items-center gap-1">
                  Open lease <ArrowRight className="size-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
