import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Banknote } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useLandlordProfile, payToLine } from "@/hooks/use-landlord-profile";

type Props = {
  leaseId: string;
  tenantName?: string | null;
  suggestedAmount?: number;
  onRecorded?: () => void;
};

export function RecordPaymentDialog({ leaseId, tenantName, suggestedAmount, onRecorded }: Props) {
  const { user } = useAuth();
  const { data: profile } = useLandlordProfile(user?.id ?? null);
  const payTo = payToLine(profile);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(suggestedAmount ? String(suggestedAmount) : "");
  const [source, setSource] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));

  const submit = async () => {
    setError(null);
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("landlord_record_payment", {
      _lease_id: leaseId,
      _amount: Number(amount),
      _source: source,
      _reference: reference.trim() || undefined,
      _paid_at: new Date(paidAt).toISOString(),
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success("Payment recorded — invoice and arrears updated");
    setOpen(false);
    setAmount("");
    setReference("");
    onRecorded?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Banknote className="size-4 mr-1.5" /> Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {tenantName ? `Payment received from ${tenantName}.` : "Payment received off-platform."} This is confirmed
            immediately and clears the oldest open invoice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount (KES)</Label>
            <Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="mpesa_paybill">M-Pesa paybill</SelectItem>
                  <SelectItem value="diaspora">Diaspora remittance</SelectItem>
                  <SelectItem value="manual_adjustment">Manual adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date received</Label>
              <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          </div>
          {payTo && (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Settles to <span className="font-medium text-foreground">{payTo}</span>
              {profile?.business_name ? ` (${profile.business_name})` : ""}.{" "}
              <Link to="/app/landlord/profile" className="underline">Edit</Link>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">Reference (optional)</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / transaction code" />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !amount || Number(amount) < 1}>
            {saving ? "Recording…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
