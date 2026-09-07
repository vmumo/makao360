import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Zap, AlertTriangle, Sparkles } from "lucide-react";
import { formatKES } from "@/lib/format";

export function RentFulizaDialog({
  leaseId,
  rentAmount,
  hasActiveAdvance,
  trigger,
  onDone,
}: {
  leaseId: string;
  rentAmount: number;
  hasActiveAdvance: boolean;
  trigger?: React.ReactNode;
  onDone?: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const eligibility = useQuery({
    queryKey: ["fuliza-eligibility", leaseId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_fuliza_eligibility", { _lease_id: leaseId });
      if (error) throw error;
      return data as {
        eligible_amount: number;
        base_limit: number;
        trust_score: number;
        repaid_count: number;
        default_count: number;
        active_outstanding: number;
        fee_estimate: number;
        rent_amount: number;
        has_active_advance: boolean;
      };
    },
  });

  const limit = eligibility.data?.eligible_amount ?? Math.floor(rentAmount / 2);
  const [amount, setAmount] = useState(Math.min(Math.floor(rentAmount / 2), 5000));
  const [reason, setReason] = useState("");
  const [inlineError, setInlineError] = useState<{ title: string; description?: string } | null>(null);

  useEffect(() => {
    if (eligibility.data) {
      setAmount(Math.min(eligibility.data.eligible_amount, 5000));
    }
  }, [eligibility.data]);

  const fee = Math.max(50, Math.floor((amount * 5) / 100));

  const reset = () => {
    setAmount(Math.min(limit, 5000));
    setReason("");
    setInlineError(null);
  };

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("request_rent_fuliza", {
        _lease_id: leaseId,
        _amount: amount,
        _reason: reason || undefined,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success(`Rent Fuliza approved! ${formatKES(amount)} credited to your cycle.`);
      void qc.invalidateQueries({ queryKey: ["tenant-leases"] });
      void qc.invalidateQueries({ queryKey: ["tenant-advances"] });
      void qc.invalidateQueries({ queryKey: ["tenant-contribs-recent"] });
      setOpen(false);
      reset();
      onDone?.();
    },
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : String(e);
      let friendly = raw;
      let description: string | undefined;
      if (/already have an active advance/i.test(raw)) {
        friendly = "You already have an active advance";
        description = "Repay your current Rent Fuliza before requesting another.";
      } else if (/Advance limit/i.test(raw)) {
        friendly = "Above your limit";
        description = `Your current limit is ${formatKES(limit)} (50% of rent).`;
      } else if (/Not your lease/i.test(raw)) {
        friendly = "This lease isn't yours";
      } else if (/PGRST00[12]|503|fetch|network/i.test(raw)) {
        friendly = "Backend is reloading — try again in a moment";
      }
      setInlineError({ title: friendly, description });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="border-warning/40 text-foreground">
            <Zap className="size-4 mr-1.5 text-warning" /> Rent Fuliza
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-warning" /> Request a Rent Fuliza
          </DialogTitle>
          <DialogDescription>
            Need more time to top up rent? Borrow a portion now and repay within 14 days.
          </DialogDescription>
        </DialogHeader>

        {hasActiveAdvance ? (
          <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 text-sm flex gap-2">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">You have an active Rent Fuliza</div>
              <div className="text-muted-foreground">
                Clear your current advance before taking a new one.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-warning/15 to-accent/10 border p-4 text-sm space-y-1">
              <div className="flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3.5 text-warning" /> Platform-calculated limit
              </div>
              <div className="text-2xl font-display font-bold">
                {eligibility.isLoading ? "…" : formatKES(limit)}
              </div>
              <div className="text-xs text-muted-foreground">
                {eligibility.data ? (
                  <>
                    Based on your repayment history (trust score {Math.round(eligibility.data.trust_score * 100)}%):{" "}
                    {eligibility.data.repaid_count} repaid, {eligibility.data.default_count} defaults.
                    Base limit: {formatKES(eligibility.data.base_limit)} (50% of {formatKES(rentAmount)} rent).
                  </>
                ) : (
                  <>50% of your monthly rent ({formatKES(rentAmount)}).</>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuliza-amount">Amount (KES)</Label>
              <Input
                id="fuliza-amount"
                type="number"
                min={1}
                max={limit}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fuliza-reason">Reason (optional)</Label>
              <Textarea
                id="fuliza-reason"
                rows={2}
                placeholder="e.g. Salary delayed by a few days"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
              <Row label="You receive" value={formatKES(amount)} />
              <Row label="Service fee (5%)" value={formatKES(fee)} muted />
              <Row label="To repay in 14 days" value={formatKES(amount + fee)} bold />
            </div>

            {inlineError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-destructive">{inlineError.title}</div>
                    {inlineError.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {inlineError.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {!hasActiveAdvance && (
            <Button
              disabled={mut.isPending || amount < 1 || amount > limit}
              onClick={() => {
                setInlineError(null);
                mut.mutate();
              }}
            >
              {mut.isPending ? "Approving…" : `Take ${formatKES(amount)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
