import { createFileRoute } from "@tanstack/react-router";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Users, Copy, Send, RefreshCw, Link2, Home, Loader2, Upload, ShieldCheck, MessageCircle, MessageSquare } from "lucide-react";
import { formatKES, formatDate, normalizeKePhone } from "@/lib/format";
import { useVacantUnits } from "@/hooks/use-vacant-units";
import { BulkImportDialog, type ImportResult } from "@/components/BulkImportDialog";

export const Route = createFileRoute("/app/landlord/tenants")({
  component: TenantsPage,
});

const inviteSchema = z.object({
  tenant_phone: z.string(),
  tenant_name: z.string().trim().max(120).optional(),
  unit_id: z.string().uuid(),
  rent_amount: z.coerce.number().int().min(100),
  deposit_amount: z.coerce.number().int().min(0),
  rent_due_day: z.coerce.number().int().min(1).max(28),
  start_date: z.string().min(1),
});

function TenantsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adminView, setAdminView] = useState(true);
  const allLandlords = isAdmin && adminView;

  const { units: vacantUnits, count: vacantCount, isLoading: vacantLoading, hasVacancy } =
    useVacantUnits({ allLandlords });

  const { data: invites, isLoading } = useQuery({
    queryKey: ["invites", user?.id, allLandlords],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("tenant_invites")
        .select("*, units(label, properties(name))");
      if (!allLandlords) q = q.eq("landlord_id", user!.id);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: leases } = useQuery({
    queryKey: ["landlord-leases", user?.id, allLandlords],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("leases")
        .select("id, status, rent_amount, start_date, units(label, properties(name)), profiles:tenant_id(full_name, phone)");
      if (!allLandlords) q = q.eq("landlord_id", user!.id);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const landlordForUnit = (unitId: string) =>
    vacantUnits.find((u) => u.id === unitId)?.properties.landlord_id ?? user!.id;

  const onInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = normalizeKePhone(String(fd.get("tenant_phone") ?? ""));
    if (!phone) { toast.error("Enter a valid Kenyan phone (07XX or +2547XX...)"); return; }
    const parsed = inviteSchema.safeParse({
      tenant_phone: phone,
      tenant_name: fd.get("tenant_name") || undefined,
      unit_id: fd.get("unit_id"),
      rent_amount: fd.get("rent_amount"),
      deposit_amount: fd.get("deposit_amount") || 0,
      rent_due_day: fd.get("rent_due_day") || 1,
      start_date: fd.get("start_date"),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const ownerId = landlordForUnit(parsed.data.unit_id);
    const { data, error } = await supabase.from("tenant_invites").insert([{
      ...parsed.data,
      tenant_name: parsed.data.tenant_name ?? null,
      landlord_id: ownerId,
    }]).select("invite_code").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Invite created", {
      description: `Send it to ${parsed.data.tenant_phone} — code ${data.invite_code}.`,
      duration: 10000,
      action: {
        label: "WhatsApp",
        onClick: () => shareWhatsApp(data.invite_code, parsed.data.tenant_phone, parsed.data.tenant_name),
      },
    });
    setOpen(false);
    void qc.invalidateQueries({ queryKey: ["invites"] });
  };

  const copyLink = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(url);
    toast.success("Invite link copied", {
      description: url,
      duration: 8000,
      action: {
        label: "Open",
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
    });
  };

  const copyCode = async (code: string) => {
    const url = `${window.location.origin}/invite/${code}`;
    await navigator.clipboard.writeText(code);
    toast.success(`Code ${code} copied`, {
      description: "Tenants can paste this on the join screen.",
      duration: 8000,
      action: {
        label: "Open link",
        onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
      },
    });
  };

  const inviteMessage = (code: string, name?: string | null) => {
    const url = `${window.location.origin}/invite/${code}`;
    const greeting = name ? `Hi ${name},` : "Hi,";
    return `${greeting} you've been invited to join your home on Makao360. Tap to accept your lease and start saving for rent: ${url} (invite code: ${code})`;
  };

  const shareWhatsApp = (code: string, phone: string, name?: string | null) => {
    const to = phone.replace(/[^0-9]/g, "");
    window.open(
      `https://wa.me/${to}?text=${encodeURIComponent(inviteMessage(code, name))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const shareSms = (code: string, phone: string, name?: string | null) => {
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(inviteMessage(code, name))}`;
  };


  const onResend = async (id: string) => {
    const { data, error } = await supabase.rpc("resend_invite", { _invite_id: id, _extend_days: 14 });
    if (error) { toast.error(error.message); return; }
    toast.success("Invite resent", { description: `New expiry: ${new Date(data as string).toLocaleDateString()}` });
    void qc.invalidateQueries({ queryKey: ["invites"] });
  };

  // Quick-create an invite for a specific vacant unit
  const onQuickInvite = async (unitId: string, rent: number, deposit: number) => {
    const phoneRaw = window.prompt("Tenant phone (07XX XXX XXX or +2547XX...)");
    if (!phoneRaw) return;
    const phone = normalizeKePhone(phoneRaw);
    if (!phone) { toast.error("Invalid Kenyan phone"); return; }
    const { data, error } = await supabase.from("tenant_invites").insert([{
      tenant_phone: phone,
      unit_id: unitId,
      rent_amount: rent,
      deposit_amount: deposit,
      rent_due_day: 1,
      start_date: new Date().toISOString().slice(0, 10),
      landlord_id: landlordForUnit(unitId),
    }]).select("invite_code").single();
    if (error) { toast.error(error.message); return; }
    await copyLink(data.invite_code);
    void qc.invalidateQueries({ queryKey: ["invites"] });
  };

  return (
    <div>
      <PageHeader
        title="Tenants & invites"
        description="Invite tenants to a vacant unit. They'll receive a code and link to join."
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant={adminView ? "default" : "outline"}
              onClick={() => setAdminView((v) => !v)}
            >
              <ShieldCheck className="size-4 mr-2" />
              {adminView ? "Admin view: all landlords" : "Admin view: off"}
            </Button>
          )}
          <BulkImportDialog
            trigger={<Button variant="outline"><Upload className="size-4 mr-2" /> Bulk invite</Button>}
            title="Bulk invite tenants"
            description="One row per tenant. Match by property_name + unit_label (must already exist and be vacant)."
            templateFilename="tenant-invites-template.xlsx"
            templateRows={[
              { tenant_phone: "0712345678", tenant_name: "Jane Doe", property_name: "Riverside Apartments", unit_label: "A1", rent_amount: 25000, deposit_amount: 25000, rent_due_day: 1, start_date: "2026-06-01" },
              { tenant_phone: "0723456789", tenant_name: "John Kamau", property_name: "Riverside Apartments", unit_label: "A2", rent_amount: 35000, deposit_amount: 35000, rent_due_day: 5, start_date: "2026-06-01" },
            ]}
            onImport={async (rows) => bulkImportTenantInvites(rows, user!.id)}
            onDone={() => void qc.invalidateQueries({ queryKey: ["invites"] })}
          />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={vacantLoading || !hasVacancy}
                        aria-label={
                          vacantLoading
                            ? "Checking vacant units"
                            : hasVacancy
                              ? `Invite tenant — ${vacantCount} vacant unit${vacantCount === 1 ? "" : "s"} available`
                              : "Invite tenant — disabled, no vacant units"
                        }
                      >
                        {vacantLoading ? (
                          <Loader2 className="size-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="size-4 mr-2" />
                        )}
                        Invite tenant
                        {hasVacancy && (
                          <Badge variant="secondary" className="ml-2">{vacantCount}</Badge>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Invite a tenant</DialogTitle></DialogHeader>
                      <form onSubmit={onInvite} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="tenant_phone">Tenant phone</Label>
                            <Input id="tenant_phone" name="tenant_phone" placeholder="07XX XXX XXX" required />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="tenant_name">Name (optional)</Label>
                            <Input id="tenant_name" name="tenant_name" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Unit</Label>
                          <Select name="unit_id" required onValueChange={(v) => {
                            const u = vacantUnits.find((x) => x.id === v);
                            if (u) {
                              const form = document.querySelector<HTMLFormElement>("form");
                              if (form) {
                                (form.elements.namedItem("rent_amount") as HTMLInputElement).value = String(u.rent_amount);
                                (form.elements.namedItem("deposit_amount") as HTMLInputElement).value = String(u.deposit_amount);
                              }
                            }
                          }}>
                            <SelectTrigger><SelectValue placeholder="Choose a vacant unit" /></SelectTrigger>
                            <SelectContent>
                              {vacantUnits.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.properties.name} — {u.label} ({formatKES(u.rent_amount)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="rent_amount">Rent (KES)</Label>
                            <Input id="rent_amount" name="rent_amount" type="number" min={100} required />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="deposit_amount">Deposit (KES)</Label>
                            <Input id="deposit_amount" name="deposit_amount" type="number" min={0} defaultValue={0} />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="rent_due_day">Due day</Label>
                            <Input id="rent_due_day" name="rent_due_day" type="number" min={1} max={28} defaultValue={1} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="start_date">Start date</Label>
                          <Input id="start_date" name="start_date" type="date"
                                 defaultValue={new Date().toISOString().slice(0, 10)} required />
                        </div>
                        <DialogFooter>
                          <Button type="submit"><Send className="size-4 mr-2" /> Create invite</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {vacantLoading
                  ? "Checking your vacant units…"
                  : hasVacancy
                    ? `${vacantCount} vacant unit${vacantCount === 1 ? "" : "s"} ready — click to send an invite.`
                    : "Disabled: add a property with a vacant unit first. The button activates as soon as a unit is marked vacant."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          </div>
        }
      />

      {!hasVacancy && !vacantLoading && (
        <div className="mb-6 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          You need at least one vacant unit before inviting a tenant. Add a property and a unit, or mark an existing unit vacant — the Invite tenant button will activate automatically.
        </div>
      )}

      {hasVacancy ? (
        <section className="mb-8">
          <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
            <Home className="size-4 text-accent" /> Vacant units · share to fill
            <Badge variant="secondary">{vacantCount}</Badge>
          </h2>
          {vacantCount > 24 && (
            <p className="text-xs text-muted-foreground mb-2">Showing the first 24 of {vacantCount} vacant units.</p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vacantUnits.slice(0, 24).map((u) => {
              const prop = u.properties as { name: string };
              return (
                <div key={u.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-semibold truncate">{prop.name}</div>
                      <div className="text-sm text-muted-foreground">Unit {u.label} · {formatKES(u.rent_amount)}/mo</div>
                    </div>
                    <Badge variant="secondary">Vacant</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => onQuickInvite(u.id, u.rent_amount, u.deposit_amount)}
                  >
                    <Link2 className="size-4 mr-1.5" /> Generate & copy invite link
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <h2 className="font-display font-semibold mb-3">Active leases</h2>
      <div className="rounded-2xl border bg-card overflow-hidden mb-8">
        {!leases?.length ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No leases yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Tenant</th>
                <th className="text-left px-4 py-3">Unit</th>
                <th className="text-left px-4 py-3">Rent</th>
                <th className="text-left px-4 py-3">Start</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((l) => {
                const tenant = l.profiles as unknown as { full_name: string | null; phone: string | null } | null;
                const unit = l.units as { label: string; properties: { name: string } } | null;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="font-medium">{tenant?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{tenant?.phone}</div>
                    </td>
                    <td className="px-4 py-3">{unit ? `${unit.properties.name} — ${unit.label}` : "—"}</td>
                    <td className="px-4 py-3">{formatKES(l.rent_amount)}</td>
                    <td className="px-4 py-3">{formatDate(l.start_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={l.status === "active" ? "default" : "secondary"} className="capitalize">{l.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-display font-semibold mb-3 flex items-center gap-2">
        Invite history
        {invites?.length ? (
          <Badge variant="secondary">{invites.length}</Badge>
        ) : null}
      </h2>
      <p className="text-sm text-muted-foreground mb-3">Recent invites — phone, unit, when it was created, and current status. Useful to verify the invite flow during demos.</p>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !invites?.length ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Users className="size-8 mx-auto text-muted-foreground" />
          <h3 className="mt-3 font-display font-semibold">No invites yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Invite a tenant to get started.</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Unit</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Created</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => {
                const unit = i.units as { label: string; properties: { name: string } } | null;
                const used = !!i.accepted_at;
                const expired = !used && new Date(i.expires_at) < new Date();
                return (
                  <tr key={i.id} className="border-t">
                    <td className="px-4 py-3">
                      <div>{i.tenant_phone}</div>
                      {i.tenant_name && <div className="text-xs text-muted-foreground">{i.tenant_name}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {unit ? `${unit.properties.name} — ${unit.label}` : "—"}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{formatDate(i.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{i.invite_code}</td>
                    <td className="px-4 py-3">
                      <Badge variant={used ? "default" : expired ? "destructive" : "secondary"}>
                        {used ? "Accepted" : expired ? "Expired" : "Pending"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {!used && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => copyCode(i.invite_code)}>
                              <Copy className="size-3.5 mr-1" /> Code
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => copyLink(i.invite_code)}>
                              <Link2 className="size-3.5 mr-1" /> Link
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => shareWhatsApp(i.invite_code, i.tenant_phone, i.tenant_name)}
                              title={`Send this invite to ${i.tenant_phone} on WhatsApp`}
                            >
                              <MessageCircle className="size-3.5 mr-1" /> WhatsApp
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => shareSms(i.invite_code, i.tenant_phone, i.tenant_name)}
                              title={`Send this invite to ${i.tenant_phone} by SMS`}
                            >
                              <MessageSquare className="size-3.5 mr-1" /> SMS
                            </Button>

                            {(expired || (i.resent_count ?? 0) >= 0) && (
                              <Button size="sm" variant={expired ? "default" : "outline"} onClick={() => onResend(i.id)}>
                                <RefreshCw className="size-3.5 mr-1" /> Resend
                              </Button>
                            )}
                          </>
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

async function bulkImportTenantInvites(rows: Record<string, unknown>[], landlordId: string): Promise<ImportResult> {
  const errors: string[] = [];
  let ok = 0, failed = 0;

  // Load this landlord's units (with property name) for matching
  const { data: properties, error: pErr } = await supabase
    .from("properties")
    .select("id, name, units(id, label, status, rent_amount, deposit_amount)")
    .eq("landlord_id", landlordId);
  if (pErr) throw pErr;

  const unitIndex = new Map<string, { id: string; status: string; rent_amount: number; deposit_amount: number }>();
  (properties ?? []).forEach((p) => {
    (p.units ?? []).forEach((u) => {
      const key = `${p.name.toLowerCase()}||${u.label.toLowerCase()}`;
      unitIndex.set(key, u);
    });
  });

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const propName = String(r.property_name ?? "").trim();
    const unitLabel = String(r.unit_label ?? "").trim();
    const phoneRaw = String(r.tenant_phone ?? "").trim();
    if (!propName || !unitLabel || !phoneRaw) {
      errors.push(`Row ${rowNum}: missing property_name, unit_label or tenant_phone`); failed++; continue;
    }
    const phone = normalizeKePhone(phoneRaw);
    if (!phone) { errors.push(`Row ${rowNum}: invalid phone "${phoneRaw}"`); failed++; continue; }

    const unit = unitIndex.get(`${propName.toLowerCase()}||${unitLabel.toLowerCase()}`);
    if (!unit) { errors.push(`Row ${rowNum}: unit "${unitLabel}" not found in "${propName}"`); failed++; continue; }
    if (unit.status === "occupied") { errors.push(`Row ${rowNum}: unit "${unitLabel}" already occupied`); failed++; continue; }

    const rent = Number(r.rent_amount ?? unit.rent_amount);
    const deposit = Number(r.deposit_amount ?? unit.deposit_amount ?? rent);
    const dueDay = Math.min(28, Math.max(1, Number(r.rent_due_day ?? 1)));
    let startDate = String(r.start_date ?? new Date().toISOString().slice(0, 10));
    // Excel may give date as number (serial) or Date object string; normalize
    if (/^\d+$/.test(startDate)) {
      const d = new Date(Date.UTC(1899, 11, 30) + Number(startDate) * 86400000);
      startDate = d.toISOString().slice(0, 10);
    }

    const { error } = await supabase.from("tenant_invites").insert({
      tenant_phone: phone,
      tenant_name: r.tenant_name ? String(r.tenant_name) : null,
      unit_id: unit.id,
      rent_amount: Math.round(rent),
      deposit_amount: Math.round(deposit),
      rent_due_day: dueDay,
      start_date: startDate,
      landlord_id: landlordId,
    });
    if (error) { errors.push(`Row ${rowNum} (${phone}): ${error.message}`); failed++; continue; }
    ok++;
  }
  return { ok, failed, errors };
}
