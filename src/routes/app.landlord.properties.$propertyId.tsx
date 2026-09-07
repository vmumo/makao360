import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, Plus, Home } from "lucide-react";
import { formatKES } from "@/lib/format";
import { useAccessLog } from "@/hooks/use-access-log";
import { CreateLeaseDialog } from "@/components/CreateLeaseDialog";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";

export const Route = createFileRoute("/app/landlord/properties/$propertyId")({
  component: PropertyDetail,
});

const unitSchema = z.object({
  label: z.string().trim().min(1).max(50),
  rent_amount: z.coerce.number().int().min(100).max(10_000_000),
  deposit_amount: z.coerce.number().int().min(0).max(10_000_000),
  bedrooms: z.coerce.number().int().min(0).max(20),
});

function PropertyDetail() {
  const { propertyId } = Route.useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  useAccessLog("properties", propertyId);

  const { data: property } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: units, isLoading } = useQuery({
    queryKey: ["units", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*, leases(id, status, tenant_id, profiles:tenant_id(full_name, phone))")
        .eq("property_id", propertyId)
        .order("label");
      if (error) throw error;
      return data;
    },
  });

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = unitSchema.safeParse({
      label: fd.get("label"),
      rent_amount: fd.get("rent_amount"),
      deposit_amount: fd.get("deposit_amount") || 0,
      bedrooms: fd.get("bedrooms") || 1,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const { error } = await supabase.from("units").insert([{
      label: parsed.data.label,
      rent_amount: parsed.data.rent_amount,
      deposit_amount: parsed.data.deposit_amount,
      bedrooms: parsed.data.bedrooms,
      property_id: propertyId,
    }]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Unit added");
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["units", propertyId] });
  };

  return (
    <div>
      <Link
        to="/app/landlord/properties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="size-4" /> Back to properties
      </Link>
      <PageHeader
        title={property?.name ?? "Property"}
        description={property?.address ?? undefined}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4 mr-2" /> Add unit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New unit</DialogTitle></DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <Field label="Label (e.g. A1, Apt 3B)" name="label" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly rent (KES)" name="rent_amount" type="number" min={100} required />
                  <Field label="Deposit (KES)" name="deposit_amount" type="number" min={0} defaultValue={0} />
                </div>
                <Field label="Bedrooms" name="bedrooms" type="number" min={0} defaultValue={1} />
                <DialogFooter><Button type="submit">Create unit</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading units…</div>
      ) : !units || units.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Home className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No units yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add units so tenants can be assigned.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Unit</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Bedrooms</th>
                <th className="text-left px-4 py-3">Rent</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Tenant</th>
                <th className="text-left px-4 py-3">Listed publicly</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const activeLease = u.leases?.find((l: { status: string }) => l.status === "active");
                const tenant = activeLease?.profiles as { full_name: string | null; phone: string | null } | undefined;
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{u.label}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">{u.bedrooms ?? "—"}</td>
                    <td className="px-4 py-3">{formatKES(u.rent_amount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.status === "occupied" ? "default" : "secondary"} className="capitalize">
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {tenant ? (
                        <div>
                          <div>{tenant.full_name}</div>
                          <div className="text-xs text-muted-foreground">{tenant.phone}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.status === "vacant" ? (
                        <Switch
                          checked={Boolean(u.listed)}
                          aria-label={`List ${u.label} on the public vacancies page`}
                           onCheckedChange={async (v: boolean) => {
                            const { error } = await supabase
                              .from("units")
                              .update({ listed: v, available_from: v ? new Date().toISOString().slice(0, 10) : null })
                              .eq("id", u.id);
                            if (error) { toast.error(error.message); return; }
                            toast.success(v ? "Unit listed on /vacancies" : "Listing removed");
                            void qc.invalidateQueries({ queryKey: ["units", propertyId] });
                          }}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Occupied</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {activeLease ? (
                          <RecordPaymentDialog
                            leaseId={activeLease.id as string}
                            tenantName={tenant?.full_name ?? null}
                            suggestedAmount={u.rent_amount}
                            onRecorded={() => void qc.invalidateQueries({ queryKey: ["units", propertyId] })}
                          />
                        ) : (
                          <CreateLeaseDialog
                            unitId={u.id}
                            unitLabel={u.label}
                            rentAmount={u.rent_amount}
                            depositAmount={u.deposit_amount}
                            onCreated={() => void qc.invalidateQueries({ queryKey: ["units", propertyId] })}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}
