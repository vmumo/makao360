import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { readConsent, writeConsent, type ConsentChoice } from "@/lib/analytics";

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!readConsent()) setOpen(true);
  }, []);

  function save(choice: ConsentChoice) {
    writeConsent(choice);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md shadow-2xl">
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-5">
        {!showPrefs ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-foreground/80">
              We use essential cookies to run Makao360. With your consent we also use analytics
              cookies to improve the product.{" "}
              <Link to="/legal/cookies" className="underline underline-offset-4">
                Learn more
              </Link>
              .
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPrefs(true)}>
                Preferences
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => save({ necessary: true, analytics: false, marketing: false })}
              >
                Reject non-essential
              </Button>
              <Button
                size="sm"
                onClick={() => save({ necessary: true, analytics: true, marketing: true })}
              >
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-display text-base font-semibold">Cookie preferences</div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked disabled />
              <span>
                <span className="font-medium">Essential</span> — required for login, sessions,
                security. Always on.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={analytics}
                onCheckedChange={(v) => setAnalytics(Boolean(v))}
              />
              <span>
                <span className="font-medium">Analytics</span> — anonymous usage data to help us
                improve the product.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={marketing}
                onCheckedChange={(v) => setMarketing(Boolean(v))}
              />
              <span>
                <span className="font-medium">Marketing</span> — measures campaign performance
                (currently unused).
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowPrefs(false)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => save({ necessary: true, analytics, marketing })}
              >
                Save preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
