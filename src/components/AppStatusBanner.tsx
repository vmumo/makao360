import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "checking" | "connected" | "degraded";

export function AppStatusBanner({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("Checking API and auth connection…");

  const check = async () => {
    setStatus("checking");
    setMessage("Checking API and auth connection…");
    try {
      const [authRes, apiRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.rpc("get_invite_by_code", { _invite_code: "__status_check__" }),
      ]);
      if (authRes.error) throw authRes.error;
      if (apiRes.error) throw apiRes.error;
      setStatus("connected");
      setMessage("API and auth are connected.");
    } catch (error) {
      setStatus("degraded");
      setMessage(error instanceof Error ? error.message : "Could not reach API or auth. Try again.");
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const Icon = status === "connected" ? CheckCircle2 : status === "checking" ? Loader2 : WifiOff;

  return (
    <div
      className={cn(
        "relative z-20 border-b px-4 py-2 text-sm",
        status === "connected" && "border-accent/30 bg-accent/10 text-foreground",
        status === "checking" && "border-sky/30 bg-sky/10 text-foreground",
        status === "degraded" && "border-warning/40 bg-warning/15 text-foreground",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Icon className={cn("mt-0.5 size-4 shrink-0", status === "checking" && "animate-spin")} />
          <div>
            <span className="font-semibold">App status:</span> {message}
          </div>
        </div>
        {status !== "connected" && (
          <Button type="button" size="sm" variant="outline" onClick={check} className="w-full sm:w-auto">
            {status === "degraded" ? <AlertTriangle className="size-4" /> : <RefreshCw className="size-4" />}
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}