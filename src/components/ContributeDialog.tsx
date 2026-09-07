import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { normalizeKePhone, formatKES } from "@/lib/format";
import { Smartphone, CheckCircle2, Clock, Loader2 } from "lucide-react";

type Stage = "form" | "sending" | "approved" | "received";

export function ContributeDialog({
  leaseId,
  suggested,
  onDone,
  trigger,
  title = "Contribute via M-Pesa",
}: {
  leaseId: string;
  suggested: number;
  onDone?: () => void;
  trigger?: React.ReactNode;
  title?: string;
}) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("form");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ amount: number; phone: string } | null>(null);

  const reset = () => {
    setStage("form");
    setReceipt(null);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = normalizeKePhone(String(fd.get("phone") ?? ""));
    const amount = Number(fd.get("amount"));
    if (!phone) { toast.error("Enter a valid M-Pesa phone"); return; }
    if (!amount || amount < 1) { toast.error("Enter an amount"); return; }
    setSubmitting(true);
    setStage("sending");
    // Simulate STK push delay
    await new Promise((r) => setTimeout(r, 1200));
    setStage("approved");
    await new Promise((r) => setTimeout(r, 700));
    const { error } = await supabase.rpc("record_mock_contribution", {
      _lease_id: leaseId, _amount: amount, _phone: phone,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); setStage("form"); return; }
    toast.success(`KES ${amount.toLocaleString()} submitted — awaiting confirmation.`);
    setReceipt({ amount, phone });
    setStage("received");
    onDone?.();

  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Smartphone className="size-4 mr-1.5" /> Pay via M-Pesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{stage === "received" ? "Payment submitted" : title}</DialogTitle></DialogHeader>

        {stage === "form" && (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We'll send an STK push to your phone. Approve it to complete the contribution.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input id="amount" name="amount" type="number" min={1} defaultValue={suggested} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">M-Pesa phone</Label>
              <Input id="phone" name="phone" defaultValue={profile?.phone ?? ""} required />
            </div>
            <div className="flex flex-wrap gap-2">
              {[500, 1000, 2000, 5000].map((q) => (
                <Button key={q} type="button" size="sm" variant="outline"
                        onClick={(e) => {
                          const f = (e.currentTarget.closest("form") as HTMLFormElement);
                          (f.elements.namedItem("amount") as HTMLInputElement).value = String(q);
                        }}>
                  +{q.toLocaleString()}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Processing…" : "Send STK push"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {(stage === "sending" || stage === "approved") && (
          <ol className="space-y-3 py-2">
            <Step done title="STK push sent" sub="Check your phone for the prompt." />
            <Step
              done={stage === "approved"}
              loading={stage === "sending"}
              title={stage === "sending" ? "Waiting for you to approve…" : "PIN approved"}
              sub="This usually takes a few seconds."
            />
            <Step pending title="Recording on Makao360" sub="We'll update your cycle automatically." />
          </ol>
        )}

        {stage === "received" && receipt && (
          <div className="space-y-4">
            <ol className="space-y-3">
              <Step done title="STK push sent" />
              <Step done title="PIN approved" />
              <Step pending title={`KES ${receipt.amount.toLocaleString()} awaiting confirmation`} sub={`From ${receipt.phone}`} />
            </ol>
            <div className="rounded-xl bg-muted/30 border p-3 text-sm">
              Your landlord has been notified. The payment counts towards your rent once it is confirmed against the M-Pesa
              statement during reconciliation.
            </div>

            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done · {formatKES(receipt.amount)}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Step({
  title, sub, done, loading, pending,
}: { title: string; sub?: string; done?: boolean; loading?: boolean; pending?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={
          "size-7 rounded-full grid place-items-center mt-0.5 " +
          (done ? "bg-primary text-primary-foreground" :
           loading ? "bg-accent/15 text-accent" :
           pending ? "bg-muted text-muted-foreground" :
           "bg-muted text-muted-foreground")
        }
      >
        {done ? <CheckCircle2 className="size-4" /> :
         loading ? <Loader2 className="size-4 animate-spin" /> :
         <Clock className="size-4" />}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </li>
  );
}
