import { Component, type ErrorInfo, type ReactNode } from "react";
import { Copy, RefreshCw } from "lucide-react";
import logoUrl from "@/assets/makao360-logo.png";
import { Button } from "@/components/ui/button";

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  error: Error | null;
  details: string;
  copied: boolean;
}

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  state: GlobalErrorBoundaryState = { error: null, details: "", copied: false };

  static getDerivedStateFromError(error: Error): Partial<GlobalErrorBoundaryState> {
    return { error, details: error.stack || error.message || "Unknown app error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const details = [error.message, error.stack, info.componentStack].filter(Boolean).join("\n\n");
    this.setState({ details });
  }

  copyError = async () => {
    await navigator.clipboard?.writeText(this.state.details || this.state.error?.message || "Unknown app error");
    this.setState({ copied: true });
    window.setTimeout(() => this.setState({ copied: false }), 1800);
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "The app hit a rendering problem.";

    return (
      <main className="min-h-screen bg-gradient-hero px-4 py-8 text-primary-foreground grid place-items-center">
        <section className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white/95 p-5 text-foreground shadow-elevated sm:p-8">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Makao360" className="h-10 w-auto" />
            <div className="h-8 w-px bg-border" />
            <span className="rounded-full bg-warning/20 px-3 py-1 text-xs font-semibold text-warning-foreground">
              App recovery
            </span>
          </div>
          <h1 className="mt-6 font-display text-2xl font-bold sm:text-4xl">Makao360 needs a quick refresh</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            A page failed to mount safely. Refreshing usually clears a stale preview bundle; if it repeats, copy the error for debugging.
          </p>
          <pre className="mt-5 max-h-44 overflow-auto rounded-xl border bg-muted/70 p-3 text-xs text-foreground">
            {message}
          </pre>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={() => window.location.reload()} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <RefreshCw className="size-4" /> Refresh app
            </Button>
            <Button variant="outline" onClick={this.copyError}>
              <Copy className="size-4" /> {this.state.copied ? "Copied" : "Copy error"}
            </Button>
          </div>
        </section>
      </main>
    );
  }
}