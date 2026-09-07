import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Save } from "lucide-react";

const PRESET_DAYS = [14, 7, 3, 1];

type Prefs = {
  rent_reminder_days_before: number[];
  rent_reminder_on_due_day: boolean;
  rent_reminder_overdue: boolean;
  payout_updates: boolean;
  event_application_status: boolean;
  event_lease_signature: boolean;
  event_renewals: boolean;
  event_inspections: boolean;
  event_deposit_changes: boolean;
  event_messages: boolean;
  event_maintenance: boolean;
  channel_in_app: boolean;
  channel_sms: boolean;
  channel_email: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

const DEFAULTS: Prefs = {
  rent_reminder_days_before: [7, 3, 1],
  rent_reminder_on_due_day: true,
  rent_reminder_overdue: true,
  payout_updates: true,
  event_application_status: true,
  event_lease_signature: true,
  event_renewals: true,
  event_inspections: true,
  event_deposit_changes: true,
  event_messages: true,
  event_maintenance: true,
  channel_in_app: true,
  channel_sms: false,
  channel_email: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

export function NotificationPreferences({ audience }: { audience: "tenant" | "landlord" }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          rent_reminder_days_before: data.rent_reminder_days_before ?? DEFAULTS.rent_reminder_days_before,
          rent_reminder_on_due_day: data.rent_reminder_on_due_day,
          rent_reminder_overdue: data.rent_reminder_overdue,
          payout_updates: data.payout_updates,
          event_application_status: data.event_application_status ?? true,
          event_lease_signature: data.event_lease_signature ?? true,
          event_renewals: data.event_renewals ?? true,
          event_inspections: data.event_inspections ?? true,
          event_deposit_changes: data.event_deposit_changes ?? true,
          event_messages: data.event_messages ?? true,
          event_maintenance: data.event_maintenance ?? true,
          channel_in_app: data.channel_in_app,
          channel_sms: data.channel_sms,
          channel_email: data.channel_email,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const toggleDay = (d: number) => {
    setPrefs((p) => ({
      ...p,
      rent_reminder_days_before: p.rent_reminder_days_before.includes(d)
        ? p.rent_reminder_days_before.filter((x) => x !== d)
        : [...p.rent_reminder_days_before, d].sort((a, b) => b - a),
    }));
  };

  const onSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: user.id, ...prefs });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Notification preferences saved");
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading preferences…</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="size-4 text-accent" />
          <h3 className="font-display font-semibold">Rent reminders</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {audience === "tenant"
            ? "Choose when we remind you about upcoming rent contributions."
            : "Choose when tenants are reminded about upcoming rent for your units."}
        </p>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Days before due</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESET_DAYS.map((d) => {
            const active = prefs.rent_reminder_days_before.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`px-3 py-1.5 rounded-full text-sm border transition ${
                  active
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-background text-foreground border-border hover:border-accent"
                }`}
              >
                {d} day{d > 1 ? "s" : ""}
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-3">
          <Row
            label="On the due day"
            description="Send a reminder on rent due day."
            checked={prefs.rent_reminder_on_due_day}
            onChange={(v) => setPrefs({ ...prefs, rent_reminder_on_due_day: v })}
          />
          <Row
            label="When overdue"
            description="Keep nudging until the cycle is paid in full."
            checked={prefs.rent_reminder_overdue}
            onChange={(v) => setPrefs({ ...prefs, rent_reminder_overdue: v })}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display font-semibold mb-1">Tenancy events</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which tenancy events trigger an alert on your selected channels below.
        </p>
        <div className="space-y-3">
          <Row
            label="Application & screening updates"
            description="Submitted, screened, approved or rejected."
            checked={prefs.event_application_status}
            onChange={(v) => setPrefs({ ...prefs, event_application_status: v })}
          />
          <Row
            label="Lease signature reminders"
            description="When an agreement is sent for signing or still unsigned."
            checked={prefs.event_lease_signature}
            onChange={(v) => setPrefs({ ...prefs, event_lease_signature: v })}
          />
          <Row
            label="Renewals"
            description="Renewal offers and responses on your tenancy."
            checked={prefs.event_renewals}
            onChange={(v) => setPrefs({ ...prefs, event_renewals: v })}
          />
          <Row
            label="Inspections"
            description="Move-in, move-out and routine inspection scheduling and outcomes."
            checked={prefs.event_inspections}
            onChange={(v) => setPrefs({ ...prefs, event_inspections: v })}
          />
          <Row
            label="Deposit changes"
            description="Deductions, refunds and any adjustment to your deposit."
            checked={prefs.event_deposit_changes}
            onChange={(v) => setPrefs({ ...prefs, event_deposit_changes: v })}
          />
          <Row
            label="Messages"
            description="New messages from your landlord, caretaker or tenant."
            checked={prefs.event_messages}
            onChange={(v) => setPrefs({ ...prefs, event_messages: v })}
          />
          <Row
            label="Maintenance updates"
            description="Status changes on maintenance requests."
            checked={prefs.event_maintenance}
            onChange={(v) => setPrefs({ ...prefs, event_maintenance: v })}
          />
        </div>
      </div>



      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Payout updates</h3>
        <Row
          label="Payout status updates"
          description={
            audience === "landlord"
              ? "Get notified when a payout is initiated and confirmed."
              : "Get notified when your landlord receives a payout from your rent."
          }
          checked={prefs.payout_updates}
          onChange={(v) => setPrefs({ ...prefs, payout_updates: v })}
        />
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display font-semibold mb-4">Delivery channels</h3>
        <div className="space-y-3">
          <Row
            label="In-app"
            description="Show in your notifications list."
            checked={prefs.channel_in_app}
            onChange={(v) => setPrefs({ ...prefs, channel_in_app: v })}
          />
          <Row
            label="SMS"
            description="Receive text messages on your registered phone."
            checked={prefs.channel_sms}
            onChange={(v) => setPrefs({ ...prefs, channel_sms: v })}
          />
          <Row
            label="Email"
            description="Send to your account email."
            checked={prefs.channel_email}
            onChange={(v) => setPrefs({ ...prefs, channel_email: v })}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-display font-semibold mb-2">Quiet hours</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We'll hold non-urgent reminders during this window.
        </p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="qh_start">Start</Label>
            <Input id="qh_start" type="time" value={prefs.quiet_hours_start ?? ""}
                   onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qh_end">End</Label>
            <Input id="qh_end" type="time" value={prefs.quiet_hours_end ?? ""}
                   onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value || null })} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          <Save className="size-4 mr-2" /> {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}

function Row({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
