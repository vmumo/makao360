import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Building2, CalendarClock, CalendarPlus, CheckCircle2, MapPin } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { downloadIcs } from "@/lib/ics";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/vacancies/$unitId")({
  head: () => ({
    meta: [
      { title: "Vacant unit to rent — Makao360" },
      { name: "description", content: "See rent, deposit, amenities, photos and location for this vacant unit, and apply online in minutes." },
      { property: "og:title", content: "Vacant unit on Makao360" },
      { property: "og:description", content: "Rent, deposit, amenities and location — apply online in minutes." },
      { property: "og:image", content: "https://makao-360-hub.lovable.app/og-product.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://makao-360-hub.lovable.app/og-product.jpg" },
      { name: "twitter:title", content: "Vacant unit on Makao360" },
      { name: "twitter:description", content: "Rent, deposit, amenities and location — apply online in minutes." },
    ],
  }),
  component: VacancyDetail,
});

type Detail = {
  unit_id: string;
  label: string;
  rent_amount: number;
  deposit_amount: number;
  bedrooms: number | null;
  listing_title: string | null;
  listing_description: string | null;
  listing_photos: string[] | null;
  listing_amenities: string[] | null;
  available_from: string | null;
  property_name: string;
  city: string | null;
  county: string | null;
  address: string | null;
};

function VacancyDetail() {
  const { unitId } = Route.useParams();
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-vacancy", unitId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_vacancy_detail", { _unit_id: unitId });
      if (error) throw error;
      return ((data ?? []) as Detail[])[0] ?? null;
    },
  });

  const onApply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSending(true);
    const { error } = await supabase.rpc("submit_public_application", {
      _unit_id: unitId,
      _name: String(fd.get("name") ?? ""),
      _phone: String(fd.get("phone") ?? ""),
      _email: String(fd.get("email") ?? "") || undefined,
      _monthly_income: Number(fd.get("income") ?? 0),
      _employment_status: String(fd.get("employment") ?? "") || undefined,
      _employer: String(fd.get("employer") ?? "") || undefined,
      _dependents: Number(fd.get("dependents") ?? 0),
      _notes: String(fd.get("notes") ?? "") || undefined,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-20">
        <Link to="/vacancies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" /> All vacancies
        </Link>

        {isLoading ? (
          <div className="mt-8 text-sm text-muted-foreground">Loading listing…</div>
        ) : !data ? (
          <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
            <Building2 className="size-8 mx-auto text-muted-foreground" />
            <h1 className="mt-3 font-display font-semibold">This unit is no longer listed</h1>
            <p className="text-sm text-muted-foreground mt-1">It may have been taken. Browse other vacancies.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold">
                {data.listing_title ?? `${data.property_name} · ${data.label}`}
              </h1>
              <p className="mt-2 text-muted-foreground flex items-center gap-1">
                <MapPin className="size-4" aria-hidden="true" />
                {[data.address, data.city, data.county].filter(Boolean).join(", ") || "Kenya"}
              </p>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Rent / month" value={formatKES(data.rent_amount)} />
                <Stat label="Deposit" value={formatKES(data.deposit_amount)} />
                <Stat label="Bedrooms" value={`${data.bedrooms ?? "—"}`} />
                <Stat label="Available" value={formatDate(data.available_from)} />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {(data.listing_photos ?? []).length > 0 ? (
                  (data.listing_photos ?? []).map((p, i) => (
                    <img
                      key={p}
                      src={p}
                      alt={`Photo ${i + 1} of ${data.property_name} unit ${data.label}`}
                      loading="lazy"
                      className="rounded-2xl border object-cover aspect-[4/3] w-full"
                    />
                  ))
                ) : (
                  <div className="sm:col-span-2 rounded-2xl border border-dashed aspect-[16/7] grid place-items-center text-muted-foreground">
                    <Building2 className="size-8" aria-hidden="true" />
                  </div>
                )}
              </div>

              {data.listing_description && (
                <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed">{data.listing_description}</p>
              )}

              {(data.listing_amenities ?? []).length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {(data.listing_amenities ?? []).map((a) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5 lg:sticky lg:top-24 h-fit">
              <ViewingBooking
                unitId={unitId}
                unitTitle={data ? `${data.property_name} · ${data.label}` : "Unit viewing"}
                location={data ? [data.address, data.city, data.county].filter(Boolean).join(", ") : ""}
              />

              <aside className="rounded-2xl border bg-card p-5">
                {submitted ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="size-10 mx-auto text-accent" />
                    <h2 className="mt-3 font-display font-semibold">Application sent</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The landlord has been notified. Create a Makao360 account with the same phone number to track
                      screening and lease signing.
                    </p>
                    <Button asChild className="mt-4 w-full">
                      <Link to="/signup" search={{ invite: undefined, phone: undefined }}>Create account</Link>
                    </Button>
                  </div>
                ) : (
                  <form className="space-y-3" onSubmit={onApply}>
                    <div>
                      <h2 className="font-display font-semibold">Apply for this unit</h2>
                      <p className="text-xs text-muted-foreground">Takes two minutes. No fees to apply.</p>
                    </div>
                    <FormField label="Full name" name="name" required />
                    <FormField label="Phone" name="phone" placeholder="07XX XXX XXX" required />
                    <FormField label="Email (optional)" name="email" type="email" />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Monthly income (KES)" name="income" type="number" min={0} />
                      <FormField label="Dependents" name="dependents" type="number" min={0} defaultValue={0} />
                    </div>
                    <FormField label="Employment status" name="employment" placeholder="employed / self_employed" />
                    <FormField label="Employer (optional)" name="employer" />
                    <div className="space-y-1.5">
                      <Label htmlFor="notes">Anything else?</Label>
                      <Textarea id="notes" name="notes" rows={3} placeholder="Move-in date, family size…" />
                    </div>
                    <Button type="submit" className="w-full" disabled={sending}>
                      {sending ? "Sending…" : "Submit application"}
                    </Button>
                  </form>
                )}
              </aside>
            </div>

          </div>
        )}
      </section>
      <MarketingFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function FormField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

type Slot = {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  mode: "self_guided" | "guided";
  capacity: number;
  booked_count: number;
  seats_left: number;
  instructions: string | null;
};

type Confirmation = {
  confirmation_code: string;
  starts_at: string;
  ends_at: string;
  mode: string;
  instructions: string | null;
  contact_phone: string | null;
};

type ManagedBooking = Confirmation & {
  booking_id: string;
  slot_id: string;
  status: string;
  applicant_name: string;
};

/** Public viewing booking: applicants pick a published slot and get a confirmation code. */
function ViewingBooking({
  unitId,
  unitTitle,
  location,
}: {
  unitId: string;
  unitTitle: string;
  location: string;
}) {
  const [slotId, setSlotId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Confirmation | null>(null);

  const { data: slots = [], isLoading, refetch } = useQuery({
    queryKey: ["public-unit-slots", unitId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_unit_slots", { _unit_id: unitId });
      if (error) throw error;
      return (data ?? []) as Slot[];
    },
  });

  const saveInvite = (c: Confirmation) => {
    downloadIcs(`viewing-${c.confirmation_code}`, {
      uid: c.confirmation_code,
      title: `Viewing: ${unitTitle}`,
      description: [
        `Confirmation code: ${c.confirmation_code}`,
        c.mode === "self_guided" ? "Self-guided viewing" : "Hosted viewing",
        c.instructions,
      ]
        .filter(Boolean)
        .join("\n"),
      location,
      start: c.starts_at,
      end: c.ends_at,
      organizerPhone: c.contact_phone,
    });
  };

  const onBook = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slotId) { setError("Pick a viewing time first."); return; }
    const fd = new FormData(e.currentTarget);
    setBooking(true);
    setError(null);
    const { data, error } = await supabase.rpc("book_viewing", {
      _slot_id: slotId,
      _name: String(fd.get("vname") ?? ""),
      _phone: String(fd.get("vphone") ?? ""),
      _email: String(fd.get("vemail") ?? "") || undefined,
      _note: String(fd.get("vnote") ?? "") || undefined,
    });
    setBooking(false);
    if (error) { setError(error.message); return; }
    setConfirmed(data as unknown as Confirmation);
    void refetch();
  };

  if (isLoading) {
    return <aside className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Loading viewing times…</aside>;
  }

  if (confirmed) {
    return (
      <aside className="rounded-2xl border bg-card p-5">
        <CheckCircle2 className="size-9 text-accent" />
        <h2 className="mt-3 font-display font-semibold">Viewing confirmed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateTime(confirmed.starts_at)} ·{" "}
          {confirmed.mode === "self_guided" ? "Self-guided viewing" : "Hosted viewing"}
        </p>
        <p className="mt-3 text-sm">
          Confirmation code: <span className="font-mono font-semibold">{confirmed.confirmation_code}</span>
        </p>
        {confirmed.instructions && (
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{confirmed.instructions}</p>
        )}
        {confirmed.contact_phone && (
          <p className="mt-2 text-sm text-muted-foreground">Contact on site: {confirmed.contact_phone}</p>
        )}
        <Button variant="outline" className="mt-3 w-full" onClick={() => saveInvite(confirmed)}>
          <CalendarPlus className="size-4" /> Add to calendar
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Show this code at the gate. The landlord has been notified, and we'll remind you before the viewing.
        </p>
        <ManageBooking unitId={unitId} unitTitle={unitTitle} location={location} slots={slots} onChanged={() => void refetch()} />
      </aside>
    );
  }

  if (slots.length === 0) {
    return (
      <aside className="rounded-2xl border border-dashed bg-card p-5">
        <h2 className="font-display font-semibold flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden="true" /> Viewings
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No viewing times published yet. Submit an application below and the landlord will arrange a visit.
        </p>
        <ManageBooking unitId={unitId} unitTitle={unitTitle} location={location} slots={slots} onChanged={() => void refetch()} />
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border bg-card p-5">
      <h2 className="font-display font-semibold flex items-center gap-2">
        <CalendarClock className="size-4" aria-hidden="true" /> Book a viewing
      </h2>
      <p className="text-xs text-muted-foreground">Pick a time. You'll get a confirmation code instantly.</p>

      <div className="mt-3 space-y-2">
        {slots.map((s) => {
          const active = s.slot_id === slotId;
          return (
            <button
              key={s.slot_id}
              type="button"
              onClick={() => setSlotId(s.slot_id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                active ? "border-accent bg-accent/10" : "hover:border-accent"
              }`}
              aria-pressed={active}
            >
              <div className="font-medium">{formatDateTime(s.starts_at)}</div>
              <div className="text-xs text-muted-foreground">
                {s.mode === "self_guided" ? "Self-guided" : "Hosted"} · {s.seats_left} seat
                {s.seats_left === 1 ? "" : "s"} left
              </div>
            </button>
          );
        })}
      </div>

      <form className="mt-4 space-y-3" onSubmit={onBook}>
        <FormField label="Full name" name="vname" required />
        <FormField label="Phone" name="vphone" placeholder="07XX XXX XXX" required />
        <FormField label="Email (optional)" name="vemail" type="email" />
        <div className="space-y-1.5">
          <Label htmlFor="vnote">Note for the landlord (optional)</Label>
          <Textarea id="vnote" name="vnote" rows={2} placeholder="I'll come with my spouse…" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={booking}>
          {booking ? "Booking…" : "Confirm viewing"}
        </Button>
      </form>

      <ManageBooking unitId={unitId} unitTitle={unitTitle} location={location} slots={slots} onChanged={() => void refetch()} />
    </aside>
  );
}

/** Self-serve lookup, reschedule and cancel using confirmation code + phone. */
function ManageBooking({
  unitId,
  unitTitle,
  location,
  slots,
  onChanged,
}: {
  unitId: string;
  unitTitle: string;
  location: string;
  slots: Slot[];
  onChanged: () => void;
}) {
  const [openPanel, setOpenPanel] = useState(false);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<ManagedBooking | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");

  const lookup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("get_viewing_booking", { _code: code, _phone: phone });
    setBusy(false);
    if (error) { setErr(error.message); setFound(null); return; }
    setFound(data as unknown as ManagedBooking);
  };

  const cancel = async () => {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc("cancel_viewing_booking", { _code: code, _phone: phone });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    toast.success("Viewing cancelled");
    setFound(found ? { ...found, status: "cancelled" } : null);
    onChanged();
  };

  const reschedule = async () => {
    if (!moveTo) { setErr("Pick a new time first."); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc("reschedule_viewing_booking", {
      _code: code, _phone: phone, _new_slot_id: moveTo,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const next = data as unknown as Confirmation;
    toast.success("Viewing moved");
    setFound(found ? { ...found, ...next, status: "booked" } : null);
    setMoveTo("");
    onChanged();
  };

  const addToCalendar = () => {
    if (!found) return;
    downloadIcs(`viewing-${found.confirmation_code}`, {
      uid: found.confirmation_code,
      title: `Viewing: ${unitTitle}`,
      description: [`Confirmation code: ${found.confirmation_code}`, found.instructions].filter(Boolean).join("\n"),
      location,
      start: found.starts_at,
      end: found.ends_at,
      organizerPhone: found.contact_phone,
      status: found.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    });
  };

  const otherSlots = slots.filter((s) => s.slot_id !== found?.slot_id && s.seats_left > 0);

  if (!openPanel) {
    return (
      <button
        type="button"
        onClick={() => setOpenPanel(true)}
        className="mt-4 w-full text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Already booked? Reschedule or cancel your viewing
      </button>
    );
  }

  return (
    <div className="mt-4 border-t pt-4" id={`manage-viewing-${unitId}`}>
      <h3 className="font-display text-sm font-semibold">Manage your viewing</h3>
      <form className="mt-2 space-y-2" onSubmit={lookup}>
        <div className="space-y-1.5">
          <Label htmlFor="mcode">Confirmation code</Label>
          <Input id="mcode" value={code} onChange={(e) => setCode(e.target.value)} placeholder="A1B2C3" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mphone">Phone used to book</Label>
          <Input id="mphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" required />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={busy}>
          {busy ? "Checking…" : "Find my booking"}
        </Button>
      </form>

      {err && <p className="mt-2 text-sm text-destructive">{err}</p>}

      {found && (
        <div className="mt-3 rounded-xl border p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{formatDateTime(found.starts_at)}</span>
            <Badge variant={found.status === "cancelled" ? "secondary" : "default"}>{found.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {found.mode === "self_guided" ? "Self-guided" : "Hosted"} · code{" "}
            <span className="font-mono">{found.confirmation_code}</span>
          </p>

          {found.status !== "cancelled" && (
            <>
              {otherSlots.length > 0 && (
                <div className="mt-3 space-y-2">
                  <Label htmlFor="move-to">Move to another time</Label>
                  <select
                    id="move-to"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={moveTo}
                    onChange={(e) => setMoveTo(e.target.value)}
                  >
                    <option value="">Select a new time…</option>
                    {otherSlots.map((s) => (
                      <option key={s.slot_id} value={s.slot_id}>
                        {formatDateTime(s.starts_at)} · {s.seats_left} seat{s.seats_left === 1 ? "" : "s"} left
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" className="w-full" onClick={reschedule} disabled={busy}>
                    Reschedule
                  </Button>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={addToCalendar}>
                  <CalendarPlus className="size-4" /> Calendar
                </Button>
                <Button variant="ghost" className="flex-1 text-destructive" onClick={cancel} disabled={busy}>
                  Cancel viewing
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
