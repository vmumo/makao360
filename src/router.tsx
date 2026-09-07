import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { Copy, RefreshCw } from "lucide-react";
import logoUrl from "@/assets/makao360-logo.png";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const copy = () => void navigator.clipboard?.writeText(error.stack || error.message || "Unknown app error");

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-8 text-primary-foreground">
      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white/95 p-5 text-foreground shadow-elevated sm:p-8">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Makao360" className="h-10 w-auto" />
          <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning-foreground">
            Route recovery
          </span>
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold sm:text-4xl">This page did not load cleanly</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Refresh the app or copy the error if it keeps happening.
        </p>
        <pre className="mt-5 max-h-44 overflow-auto rounded-xl border bg-muted/70 p-3 text-left font-mono text-xs text-foreground">
          {error.message || "Unknown route error"}
        </pre>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
          <button
            onClick={copy}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Copy className="size-4" /> Copy error
          </button>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
