import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CalendarClock, CalendarPlus, KeyRound, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";

type Slot = {
  id: string;
  unit_id: string;
  starts_at: string;
  ends_at: string;
  mode: "self_guided" | "guided";
  capacity: number;
  booked_count: number;
  instructions: string | null;
  contact_phone: string | null;
  status: "open" | "closed" | "cancelled";
  units: { label: string; properties: { name: string } | null } | null;
};

type Booking = {
  id: string;
  slot_id: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string | null;
  note: string | null;
  status: string;
  confirmation_code: string;
  created_at: string;
};

type Blackout = {
  id: string;
  unit_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  units: { label: string; properties: { name: string } | null } | null;
};

/** Landlord-side scheduling of self-guided and guided unit viewings. */
export function ViewingsManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [blackoutOpen, setBlackoutOpen] = useState(false);
  const [blackoutError, setBlackoutError] = useState<string | null>(null);

  const { data: units = [] } = useQuery({
    queryKey: ["viewable-units", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, label, status, properties!inner(name, landlord_id)")
        .eq("properties.landlord_id", user!.id)
        .eq("status", "vacant")
        .order("label")
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; label: string; properties: { name: string } }[];
    },
  });

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ["viewing-slots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_viewing_slots")
        .select("*, units(label, properties(name))")
        .order("starts_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Slot[];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["viewing-bookings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("viewing_bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Booking[];
    },
  });

  const { data: blackouts = [] } = useQuery({
    queryKey: ["unit-blackouts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_blackouts")
        .select("*, units(label, properties(name))")
        .order("starts_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as Blackout[];
    },
  });

  const addBlackout = useMutation({
    mutationFn: async (form: FormData) => {
      const from = String(form.get("from") ?? "");
      const to = String(form.get("to") ?? "");
      if (!from || !to) throw new Error("Pick a start and end date");
      if (new Date(to) <= new Date(from)) throw new Error("The end must come after the start");
      const { error } = await supabase.from("unit_blackouts").insert({
        unit_id: String(form.get("b_unit_id") ?? ""),
        landlord_id: user!.id,
        created_by: user!.id,
        starts_at: new Date(from).toISOString(),
        ends_at: new Date(to).toISOString(),
        reason: String(form.get("reason") ?? "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blackout period saved");
      setBlackoutOpen(false);
      setBlackoutError(null);
      void qc.invalidateQueries({ queryKey: ["unit-blackouts"] });
      void qc.invalidateQueries({ queryKey: ["viewing-slots"] });
    },
    onError: (e: Error) => setBlackoutError(e.message),
  });

  const removeBlackout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unit_blackouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Blackout removed");
      void qc.invalidateQueries({ queryKey: ["unit-blackouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bySlot = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) m.set(b.slot_id, [...(m.get(b.slot_id) ?? []), b]);
    return m;
  }, [bookings]);

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      const date = String(form.get("date") ?? "");
      const start = String(form.get("start") ?? "");
      const end = String(form.get("end") ?? "");
      if (!date || !start || !end) throw new Error("Pick a date, start and end time");
      const { error } = await supabase.from("unit_viewing_slots").insert({
        unit_id: String(form.get("unit_id") ?? ""),
        landlord_id: user!.id,
        starts_at: new Date(`${date}T${start}`).toISOString(),
        ends_at: new Date(`${date}T${end}`).toISOString(),
        mode: String(form.get("mode") ?? "guided") as Slot["mode"],
        capacity: Number(form.get("capacity") ?? 1),
        instructions: String(form.get("instructions") ?? "") || null,
        contact_phone: String(form.get("contact_phone") ?? "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Viewing slot published");
      setOpen(false);
      setSlotError(null);
      void qc.invalidateQueries({ queryKey: ["viewing-slots"] });
    },
    onError: (e: Error) => setSlotError(e.message),
  });

  const setSlotStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Slot["status"] }) => {
      const { error } = await supabase.from("unit_viewing_slots").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["viewing-slots"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setBookingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("viewing_bookings")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking updated");
      void qc.invalidateQueries({ queryKey: ["viewing-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm text-muted-foreground">
          Publish self-guided or hosted viewing slots. Applicants book from the public listing and get a confirmation code.
        </p>
        <div className="flex flex-wrap gap-2">
        <Dialog open={blackoutOpen} onOpenChange={setBlackoutOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={units.length === 0}>
              <Ban className="size-4" /> Blackout dates
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark a unit unavailable</DialogTitle>
              <DialogDescription>
                Applicants can't book viewings in this window, and empty slots inside it are withdrawn.
              </DialogDescription>
            </DialogHeader>
            <form
              id="blackout-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setBlackoutError(null);
                addBlackout.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="b_unit_id">Unit</Label>
                <Select name="b_unit_id" defaultValue={units[0]?.id}>
                  <SelectTrigger id="b_unit_id"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.properties?.name} · {u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from">Unavailable from</Label>
                  <Input id="from" name="from" type="datetime-local" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">Until</Label>
                  <Input id="to" name="to" type="datetime-local" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input id="reason" name="reason" placeholder="Renovation, deep clean, holiday…" />
              </div>
            </form>
            {blackoutError && <p className="text-sm text-destructive">{blackoutError}</p>}
            <DialogFooter>
              <Button type="submit" form="blackout-form" disabled={addBlackout.isPending}>
                {addBlackout.isPending ? "Saving…" : "Save blackout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={units.length === 0}>
              <CalendarClock className="size-4" /> New viewing slot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish a viewing slot</DialogTitle>
              <DialogDescription>Applicants can self-book while seats remain.</DialogDescription>
            </DialogHeader>
            <form
              id="slot-form"
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSlotError(null);
                create.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="unit_id">Unit</Label>
                <Select name="unit_id" defaultValue={units[0]?.id}>
                  <SelectTrigger id="unit_id"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.properties?.name} · {u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start">Start</Label>
                  <Input id="start" name="start" type="time" defaultValue="10:00" required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end">End</Label>
                  <Input id="end" name="end" type="time" defaultValue="10:30" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="mode">Viewing type</Label>
                  <Select name="mode" defaultValue="guided">
                    <SelectTrigger id="mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guided">Hosted by caretaker</SelectItem>
                      <SelectItem value="self_guided">Self-guided</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Seats</Label>
                  <Input id="capacity" name="capacity" type="number" min={1} defaultValue={1} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone">Contact phone</Label>
                <Input id="contact_phone" name="contact_phone" placeholder="07XX XXX XXX" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="instructions">Access instructions</Label>
                <Textarea id="instructions" name="instructions" rows={3} placeholder="Gate code, caretaker name, where to collect keys…" />
              </div>
            </form>
            {slotError && <p className="text-sm text-destructive">{slotError}</p>}
            <DialogFooter>
              <Button type="submit" form="slot-form" disabled={create.isPending}>
                {create.isPending ? "Publishing…" : "Publish slot"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {blackouts.length > 0 && (
        <div className="mb-4 rounded-2xl border bg-muted/30 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Ban className="size-4" aria-hidden="true" /> Blackout periods
          </h3>
          <ul className="mt-2 space-y-1.5">
            {blackouts.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium">
                    {b.units?.properties?.name ?? "Property"} · {b.units?.label ?? "Unit"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {formatDateTime(b.starts_at)} → {formatDateTime(b.ends_at)}
                  </span>
                  {b.reason && <span className="text-xs text-muted-foreground"> · {b.reason}</span>}
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeBlackout.mutate(b.id)}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading viewings…</div>
      ) : slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No viewing slots yet. Publish one so applicants can book a visit.
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((s) => {
            const list = bySlot.get(s.id) ?? [];
            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {s.units?.properties?.name ?? "Property"} · {s.units?.label ?? "Unit"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(s.starts_at)} – {new Date(s.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">
                        {s.mode === "self_guided" ? <KeyRound className="size-3" /> : <Users className="size-3" />}
                        <span className="ml-1">{s.mode === "self_guided" ? "Self-guided" : "Hosted"}</span>
                      </Badge>
                      <Badge variant="outline">{s.booked_count}/{s.capacity} booked</Badge>
                      <Badge variant={s.status === "open" ? "default" : "secondary"}>{s.status}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {s.status === "open" ? (
                      <Button size="sm" variant="outline" onClick={() => setSlotStatus.mutate({ id: s.id, status: "closed" })}>
                        Close
                      </Button>
                    ) : s.status === "closed" ? (
                      <Button size="sm" variant="outline" onClick={() => setSlotStatus.mutate({ id: s.id, status: "open" })}>
                        Reopen
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => setSlotStatus.mutate({ id: s.id, status: "cancelled" })}>
                      Cancel
                    </Button>
                  </div>
                </div>

                {list.length > 0 && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {list.map((b) => (
                      <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <span className="font-medium">{b.applicant_name}</span>{" "}
                          <span className="text-muted-foreground">{b.applicant_phone}</span>{" "}
                          <Badge variant="outline" className="ml-1">#{b.confirmation_code}</Badge>{" "}
                          <Badge variant="secondary">{b.status}</Badge>
                          {b.note && <p className="text-xs text-muted-foreground">{b.note}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => setBookingStatus.mutate({ id: b.id, status: "confirmed" })}>
                            Confirm
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setBookingStatus.mutate({ id: b.id, status: "attended" })}>
                            Attended
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setBookingStatus.mutate({ id: b.id, status: "no_show" })}>
                            No show
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Download calendar invite for ${b.applicant_name}`}
                            onClick={() =>
                              downloadIcs(`viewing-${b.confirmation_code}`, {
                                uid: b.confirmation_code,
                                title: `Viewing: ${s.units?.properties?.name ?? "Property"} · ${s.units?.label ?? "Unit"}`,
                                description: `${b.applicant_name} (${b.applicant_phone}) · code ${b.confirmation_code}`,
                                location: s.units?.properties?.name ?? null,
                                start: s.starts_at,
                                end: s.ends_at,
                                organizerPhone: s.contact_phone,
                                status: b.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
                              })
                            }
                          >
                            <CalendarPlus className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
