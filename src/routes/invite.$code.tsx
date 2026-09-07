import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";
import { Home, CheckCircle2, AlertTriangle, RefreshCw, Send } from "lucide-react";

export const Route = createFileRoute("/invite/$code")({
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [accepting, setAccepting] = useState(false);
  const [resending, setResending] = useState(false);

  const { data: invite, isLoading } = useQuery({
    queryKey: ["invite", code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_invite_by_code", { _invite_code: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const handleAccept = async () => {
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_tenant_invite", { _invite_code: code });
    setAccepting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome home! Your lease is active.");
    void navigate({ to: "/app/tenant/leases/$leaseId", params: { leaseId: data as string } });
  };

  const onResend = async () => {
    setResending(true);
    const { data, error } = await supabase.rpc("request_invite_resend", { _invite_code: code });
    setResending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite refreshed!", {
      description: `Valid until ${new Date(data as string).toLocaleDateString()}. You can accept now.`,
    });
    void qc.invalidateQueries({ queryKey: ["invite", code] });
  };

  if (isLoading || loading) {
    return <CenterCard><div className="text-sm text-muted-foreground">Loading invite…</div></CenterCard>;
  }
  if (!invite) {
    return (
      <CenterCard>
        <h1 className="font-display text-xl font-semibold">Invite not found</h1>
        <p className="text-sm text-muted-foreground mt-1">Double-check the code or ask your landlord to resend.</p>
      </CenterCard>
    );
  }
  if (invite.accepted_at) {
    return (
      <CenterCard>
        <CheckCircle2 className="size-10 text-success mx-auto" />
        <h1 className="font-display text-xl font-semibold mt-3">Invite already used</h1>
        <p className="text-sm text-muted-foreground mt-1">This invite has been accepted.</p>
        <Button asChild className="mt-4"><Link to="/app">Open Makao360</Link></Button>
      </CenterCard>
    );
  }
  if (new Date(invite.expires_at) < new Date()) {
    const resentCount = (invite.resent_count ?? 0) as number;
    const lastSentAt = invite.last_sent_at as string | null;
    return (
      <div className="min-h-screen bg-background grid place-items-center px-4 py-8 sm:py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-5 sm:mb-6"><Logo /></div>
          <div className="rounded-2xl border-2 border-warning/40 bg-warning/10 p-5 sm:p-6 shadow-card">
            <div className="size-11 sm:size-12 rounded-xl bg-warning text-warning-foreground grid place-items-center mx-auto">
              <AlertTriangle className="size-5 sm:size-6" />
            </div>
            <h1 className="mt-3 sm:mt-4 font-display text-lg sm:text-xl font-bold text-center leading-tight">
              This invite has expired
            </h1>
            <p className="text-[13px] sm:text-sm text-muted-foreground text-center mt-1.5 leading-snug px-1">
              No worries — tap below and we'll refresh it instantly. Your landlord will be notified.
            </p>
            <Button
              className="w-full mt-5 sm:mt-6 bg-accent text-accent-foreground hover:bg-accent/90 h-11 text-sm sm:text-base"
              onClick={onResend}
              disabled={resending}
              size="lg"
            >
              <RefreshCw className={`size-4 mr-2 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Refreshing…" : "Resend & extend invite"}
            </Button>
            {(resentCount > 0 || lastSentAt) && (
              <div className="mt-4 rounded-lg bg-background/70 border border-border/60 px-3 py-2.5 text-[12px] sm:text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                  <Send className="size-3.5" /> Resend activity
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                  <span>Resent {resentCount} {resentCount === 1 ? "time" : "times"}</span>
                  {lastSentAt && <span className="tabular-nums">Last sent {formatDateTime(lastSentAt)}</span>}
                </div>
              </div>
            )}
            <p className="text-[11px] sm:text-xs text-muted-foreground text-center mt-3 break-all">
              Code <span className="font-mono">{code}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const phoneMismatch =
    session && profile && profile.phone && profile.phone !== invite.tenant_phone;

  return (
    <div className="min-h-screen bg-background grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6"><Logo /></div>
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center mx-auto">
            <Home className="size-6" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold text-center">
            You've been invited
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Join <span className="font-medium text-foreground">{invite.property_name}</span>{" "}
            — Unit {invite.unit_label}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <Row label="Landlord" value={invite.landlord_name ?? "—"} />
            <Row label="Monthly rent" value={formatKES(invite.rent_amount)} />
            {invite.deposit_amount > 0 && (
              <Row label="Deposit" value={formatKES(invite.deposit_amount)} />
            )}
            <Row label="Rent due" value={`Day ${invite.rent_due_day} of each month`} />
            <Row label="Start date" value={formatDate(invite.start_date)} />
            <Row label="Phone on invite" value={invite.tenant_phone} />
          </dl>

          {!session ? (
            <div className="mt-6 space-y-2">
              <Button asChild className="w-full">
                <Link to="/signup" search={{ invite: code, phone: invite.tenant_phone }}>
                  Create account & accept
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/login" search={{ invite: code, redirect: undefined }}>I already have an account</Link>
              </Button>
            </div>
          ) : phoneMismatch ? (
            <div className="mt-6 rounded-lg bg-warning/15 text-warning-foreground p-3 text-sm">
              Your account phone ({profile.phone}) doesn't match this invite ({invite.tenant_phone}).
              Sign in with the matching phone or update your profile.
            </div>
          ) : (
            <Button className="w-full mt-6" onClick={handleAccept} disabled={accepting}>
              {accepting ? "Accepting…" : "Accept and start lease"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md text-center rounded-2xl border bg-card p-8 shadow-card">
        <Logo />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
