import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSignature } from "lucide-react";

type Props = {
  unitId: string;
  unitLabel: string;
  rentAmount: number;
  depositAmount: number;
  onCreated?: (leaseId: string) => void;
};

export function CreateLeaseDialog({ unitId, unitLabel, rentAmount, depositAmount, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [rent, setRent] = useState(String(rentAmount));
  const [deposit, setDeposit] = useState(String(depositAmount));
  const [dueDay, setDueDay] = useState("5");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  const submit = async () => {
    setError(null);
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc("landlord_create_lease", {
      _unit_id: unitId,
      _tenant_phone: phone.trim(),
      _rent_amount: Number(rent),
      _deposit_amount: Number(deposit || 0),
      _rent_due_day: Number(dueDay || 5),
      _start_date: startDate,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    toast.success(`Lease created for unit ${unitLabel}`);
    setOpen(false);
    setPhone("");
    onCreated?.(data as string);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <FileSignature className="size-4 mr-1.5" /> Create lease
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create lease · Unit {unitLabel}</DialogTitle>
          <DialogDescription>
            For a tenant who already has a Makao360 account. Otherwise send them an invite.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lease-phone">Tenant phone</Label>
            <Input
              id="lease-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07xx xxx xxx"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lease-rent">Monthly rent (KES)</Label>
              <Input id="lease-rent" type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lease-deposit">Deposit (KES)</Label>
              <Input id="lease-deposit" type="number" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lease-due">Rent due day</Label>
              <Input id="lease-due" type="number" min={1} max={28} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lease-start">Start date</Label>
              <Input id="lease-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || !phone.trim()}>
            {saving ? "Creating…" : "Create lease"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
