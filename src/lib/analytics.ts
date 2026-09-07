// Lightweight in-house analytics. Sends events to public.analytics_events.
// Respects the visitor's cookie consent (analytics = true) before emitting.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "mk_session_id";
const CONSENT_KEY = "mk_cookie_consent_v1";

function getSessionId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export type ConsentChoice = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as ConsentChoice) : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
  // Best-effort log to the backend.
  void supabase.from("cookie_consents").insert({
    session_id: getSessionId(),
    necessary: choice.necessary,
    analytics: choice.analytics,
    marketing: choice.marketing,
  });
}

export async function track(event: string, properties: Record<string, unknown> = {}): Promise<void> {
  if (typeof window === "undefined") return;
  const consent = readConsent();
  if (!consent?.analytics) return; // opt-in only
  const { data: sess } = await supabase.auth.getSession();
  await supabase.from("analytics_events").insert({
    event_name: event,
    path: window.location.pathname,
    properties: properties as never,
    user_id: sess.session?.user.id ?? null,
    session_id: getSessionId(),
  });
}
