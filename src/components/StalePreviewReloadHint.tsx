import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const stalePatterns = ["SyntaxError", "Unexpected token", "Failed to fetch dynamically imported module", "Internal Server Error"];

export function StalePreviewReloadHint() {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState("The preview may be showing stale code.");
  const isPreview = useMemo(() => typeof window !== "undefined" && !import.meta.env.PROD, []);

  useEffect(() => {
    if (!isPreview) return;
    const show = (message: string) => {
      if (stalePatterns.some((p) => message.includes(p))) {
        setReason(message.slice(0, 160));
        setVisible(true);
      }
    };
    const onError = (event: ErrorEvent) => show(event.message || event.error?.message || "Preview error detected");
    const onReject = (event: PromiseRejectionEvent) => show(String(event.reason?.message || event.reason || "Preview bundle error"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, [isPreview]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-warning/40 bg-card p-3 shadow-elevated">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <div className="font-semibold">Stale preview detected</div>
          <div className="text-xs text-muted-foreground">{reason}</div>
        </div>
        <Button size="sm" onClick={() => window.location.reload()} className="bg-warning text-warning-foreground hover:bg-warning/90">
          <RefreshCw className="size-4" /> Full reload
        </Button>
      </div>
    </div>
  );
}