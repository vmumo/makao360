import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Plus, MapPin, Home, Upload } from "lucide-react";
import { BulkImportDialog, type ImportResult } from "@/components/BulkImportDialog";

export const Route = createFileRoute("/app/landlord/properties/")({
  component: PropertiesPage,
});

const propertySchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  property_type: z.enum(["apartment", "bedsitter", "studio", "bungalow", "maisonette", "commercial", "mixed_use"]),
  notes: z.string().trim().max(500).optional(),
});

type PropertyCard = {
  id: string;
  name: string;
  address: string | null;
  property_type: string;
  total: number;
  occupied: number;
  owner?: string | null;
};

function PropertiesPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [search, setSearch] = useState("");

  const mine = useQuery({
    queryKey: ["properties", user?.id],
    enabled: !!user && scope === "mine",
    queryFn: async (): Promise<PropertyCard[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, units(id, status, rent_amount)")
        .eq("landlord_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        property_type: p.property_type,
        total: p.units?.length ?? 0,
        occupied: p.units?.filter((u: { status: string }) => u.status === "occupied").length ?? 0,
      }));
    },
  });

  const all = useQuery({
    queryKey: ["admin-properties", search],
    enabled: isAdmin && scope === "all",
    queryFn: async (): Promise<PropertyCard[]> => {
      const { data, error } = await supabase.rpc("admin_properties_directory", {
        _search: search || undefined,
        _corridor: undefined,
        _limit: 500,
      });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.property_id,
        name: p.name,
        address: `${p.estate} · ${p.corridor}`,
        property_type: "—",
        total: Number(p.units),
        occupied: Number(p.occupied),
        owner: p.landlord_name,
      }));
    },
  });

  const active = scope === "all" ? all : mine;
  const isLoading = active.isLoading;
  const properties = (active.data ?? []).filter((p) =>
    scope === "all" ? true : p.name.toLowerCase().includes(search.toLowerCase()),
  );



  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = propertySchema.safeParse({
      name: fd.get("name"),
      address: fd.get("address") || undefined,
      city: fd.get("city") || undefined,
      county: fd.get("county") || undefined,
      property_type: fd.get("property_type"),
      notes: fd.get("notes") || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const { error } = await supabase.from("properties").insert([{
      name: parsed.data.name,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      county: parsed.data.county ?? null,
      property_type: parsed.data.property_type,
      notes: parsed.data.notes ?? null,
      landlord_id: user!.id,
    }]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Property added");
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["properties"] });
  };

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Manage your buildings and units."
        actions={
          <div className="flex gap-2">
            <BulkImportDialog
              trigger={<Button variant="outline"><Upload className="size-4 mr-2" /> Bulk import</Button>}
              title="Bulk import properties & units"
              description="Each row = one unit. Properties are grouped by name. Required: property_name, unit_label, rent_amount."
              templateFilename="properties-template.xlsx"
              templateRows={[
                { property_name: "Riverside Apartments", address: "Riverside Drive", city: "Nairobi", county: "Nairobi", property_type: "apartment", unit_label: "A1", bedrooms: 1, rent_amount: 25000, deposit_amount: 25000 },
                { property_name: "Riverside Apartments", address: "Riverside Drive", city: "Nairobi", county: "Nairobi", property_type: "apartment", unit_label: "A2", bedrooms: 2, rent_amount: 35000, deposit_amount: 35000 },
                { property_name: "Garden Court", address: "Kilimani", city: "Nairobi", county: "Nairobi", property_type: "bedsitter", unit_label: "B1", bedrooms: 1, rent_amount: 15000, deposit_amount: 15000 },
              ]}
              onImport={async (rows) => bulkImportProperties(rows, user!.id)}
              onDone={() => void qc.invalidateQueries({ queryKey: ["properties"] })}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4 mr-2" /> Add property</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New property</DialogTitle>
                </DialogHeader>
                <form onSubmit={onCreate} className="space-y-4">
                  <Field label="Name" name="name" placeholder="e.g. Riverside Apartments" required />
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City" name="city" defaultValue="Nairobi" />
                    <Field label="County" name="county" defaultValue="Nairobi" />
                  </div>
                  <Field label="Address" name="address" placeholder="Street, estate, landmarks" />
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select name="property_type" defaultValue="apartment">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apartment">Apartment block</SelectItem>
                        <SelectItem value="bedsitter">Bedsitters</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="bungalow">Bungalow</SelectItem>
                        <SelectItem value="maisonette">Maisonette</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="mixed_use">Mixed-use</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea id="notes" name="notes" rows={2} />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Create property</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {isAdmin && (
          <div className="inline-flex rounded-lg border p-0.5">
            <Button
              size="sm"
              variant={scope === "mine" ? "default" : "ghost"}
              onClick={() => setScope("mine")}
            >
              My properties
            </Button>
            <Button
              size="sm"
              variant={scope === "all" ? "default" : "ghost"}
              onClick={() => setScope("all")}
            >
              All landlords
            </Button>
          </div>
        )}
        <Input
          className="w-[260px]"
          placeholder={scope === "all" ? "Search property or landlord" : "Search your properties"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${properties.length} shown`}
        </span>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : properties.length === 0 ? (
        <EmptyState onAdd={() => setOpen(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((p) => {
            const occupied = p.occupied;
            const total = p.total;
            return (
              <Link
                key={p.id}
                to="/app/landlord/properties/$propertyId"
                params={{ propertyId: p.id }}
                className="rounded-2xl border border-border bg-card p-5 hover:shadow-card hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Building2 className="size-5" />
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{p.property_type}</span>
                </div>
                <div className="mt-3 font-display font-semibold">{p.name}</div>
                {p.address && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="size-3" /> {p.address}
                  </div>
                )}
                {p.owner && (
                  <div className="text-xs text-muted-foreground mt-1">Landlord: {p.owner}</div>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Home className="size-3" /> {total} units</span>
                  <span>•</span>
                  <span>{occupied} occupied</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}

const VALID_TYPES = ["apartment", "bedsitter", "studio", "bungalow", "maisonette", "commercial", "mixed_use"] as const;
type PropType = typeof VALID_TYPES[number];

async function bulkImportProperties(rows: Record<string, unknown>[], landlordId: string): Promise<ImportResult> {
  const errors: string[] = [];
  let ok = 0, failed = 0;

  // Group by property_name
  const groups = new Map<string, { meta: Record<string, unknown>; units: Record<string, unknown>[] }>();
  rows.forEach((r, idx) => {
    const name = String(r.property_name ?? r.name ?? "").trim();
    if (!name) { errors.push(`Row ${idx + 2}: missing property_name`); failed++; return; }
    if (!groups.has(name)) groups.set(name, { meta: r, units: [] });
    if (r.unit_label) groups.get(name)!.units.push(r);
  });

  // Existing properties for this landlord (avoid duplicates)
  const { data: existing } = await supabase
    .from("properties").select("id, name").eq("landlord_id", landlordId);
  const existingMap = new Map((existing ?? []).map((p) => [p.name.toLowerCase(), p.id]));

  for (const [name, group] of groups) {
    try {
      let propertyId = existingMap.get(name.toLowerCase());
      if (!propertyId) {
        const type = String(group.meta.property_type ?? "apartment").toLowerCase() as PropType;
        const { data, error } = await supabase.from("properties").insert({
          landlord_id: landlordId,
          name,
          address: group.meta.address ? String(group.meta.address) : null,
          city: group.meta.city ? String(group.meta.city) : "Nairobi",
          county: group.meta.county ? String(group.meta.county) : "Nairobi",
          property_type: VALID_TYPES.includes(type) ? type : "apartment",
        }).select("id").single();
        if (error) throw error;
        propertyId = data.id;
      }
      for (const u of group.units) {
        const label = String(u.unit_label ?? "").trim();
        const rent = Number(u.rent_amount);
        if (!label || !rent || rent < 1) {
          errors.push(`"${name}" / unit "${label}": missing label or rent`); failed++; continue;
        }
        const { error: uErr } = await supabase.from("units").insert({
          property_id: propertyId,
          label,
          bedrooms: Number(u.bedrooms ?? 1),
          rent_amount: Math.round(rent),
          deposit_amount: Math.round(Number(u.deposit_amount ?? rent)),
        });
        if (uErr) { errors.push(`"${name}" / unit "${label}": ${uErr.message}`); failed++; continue; }
        ok++;
      }
    } catch (e) {
      errors.push(`Property "${name}": ${(e as Error).message}`);
      failed += group.units.length || 1;
    }
  }
  return { ok, failed, errors };
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed p-10 text-center">
      <Building2 className="size-8 mx-auto text-muted-foreground" />
      <h3 className="mt-3 font-display font-semibold">No properties yet</h3>
      <p className="text-sm text-muted-foreground mt-1">Add your first property to begin.</p>
      <Button className="mt-4" onClick={onAdd}><Plus className="size-4 mr-2" /> Add property</Button>
    </div>
  );
}
