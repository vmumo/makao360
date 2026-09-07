import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Copy, CheckCircle2, Clock, Landmark } from "lucide-react";
import { formatKES } from "@/lib/format";

type Stage = "form" | "instructions" | "submitted";

export function BankTransferDialog({
  leaseId,
  suggested,
  onDone,
  trigger,
}: {
  leaseId: string;
  suggested: number;
  onDone?: () => void;
  trigger?: React.ReactNode;
}) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [amount, setAmount] = useState(suggested);
  const [submitting, setSubmitting] = useState(false);

  // Deterministic-ish ref so the same lease always shows the same code
  const reference = useMemo(
    () => `MK360-${(leaseId.replace(/-/g, "").slice(0, 6) || "000000").toUpperCase()}`,
    [leaseId],
  );

  const reset = () => {
    setStage("form");
    setAmount(suggested);
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const onConfirm = async () => {
    if (!user) return;
    if (!amount || amount < 1) { toast.error("Enter an amount"); return; }
    setSubmitting(true);
    // Record as a pending contribution so the landlord can reconcile
    const { error } = await supabase.from("contributions").insert([{
      tenant_id: user.id,
      lease_id: leaseId,
      amount,
      source: "bank" as const,
      status: "pending",
      payer_phone: profile?.phone ?? null,
      external_ref: reference,
      note: "Bank transfer awaiting reconciliation",
    }]);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transfer noted. Landlord will confirm receipt.");
    setStage("submitted");
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="secondary">
            <Landmark className="size-4 mr-1.5" /> Bank transfer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {stage === "submitted" ? "Transfer logged" : "Pay by bank transfer"}
          </DialogTitle>
        </DialogHeader>

        {stage === "form" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter how much you'll send. We'll generate a unique reference your landlord
              will use to match the deposit to your lease.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount" type="number" min={1} value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setStage("instructions")}>
                Show bank details
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "instructions" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <Detail label="Bank" value="Equity Bank Kenya" />
              <Detail label="Account name" value="Makao360 Trust Account" />
              <Detail label="Account number" value="0123456789012" copyable onCopy={copy} />
              <Detail label="Branch / SWIFT" value="EQBLKENA" />
              <Detail label="Amount" value={formatKES(amount)} />
              <Detail
                label="Your reference"
                value={reference}
                copyable
                emphasize
                onCopy={copy}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Important:</strong> include the reference exactly as shown so we can
              match your transfer. Funds usually reflect within 1 business day.
            </p>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setStage("form")}>Back</Button>
              <Button onClick={onConfirm} disabled={submitting}>
                {submitting ? "Recording…" : "I've sent the transfer"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {stage === "submitted" && (
          <div className="space-y-4">
            <ol className="space-y-3">
              <TimelineStep
                done
                title="Transfer details generated"
                sub={`Reference ${reference}`}
              />
              <TimelineStep
                done
                title="Logged on Makao360"
                sub={`KES ${amount.toLocaleString()} marked pending`}
              />
              <TimelineStep
                title="Awaiting landlord confirmation"
                sub="You'll get a notification once the funds are matched."
                pending
              />
            </ol>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label, value, copyable, emphasize, onCopy,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  emphasize?: boolean;
  onCopy?: (text: string, label: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={emphasize ? "font-mono font-bold text-primary text-base" : "font-medium"}>
          {value}
        </div>
      </div>
      {copyable && (
        <Button size="icon" variant="ghost" onClick={() => onCopy?.(value, label)}>
          <Copy className="size-4" />
        </Button>
      )}
    </div>
  );
}

function TimelineStep({
  title, sub, done, pending,
}: { title: string; sub?: string; done?: boolean; pending?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={
          "size-7 rounded-full grid place-items-center mt-0.5 " +
          (done ? "bg-primary text-primary-foreground" :
           pending ? "bg-amber-100 text-amber-700" :
           "bg-muted text-muted-foreground")
        }
      >
        {done ? <CheckCircle2 className="size-4" /> :
         pending ? <Clock className="size-4" /> :
         <Building2 className="size-4" />}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </li>
  );
}
