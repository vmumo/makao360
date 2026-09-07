/** Minimal RFC 5545 calendar invite builder for viewing bookings. */

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string | Date;
  end: string | Date;
  organizerPhone?: string | null;
  status?: "CONFIRMED" | "CANCELLED";
};

function stamp(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Returns the full .ics file contents for a single viewing event. */
export function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Makao360//Viewings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@makao360`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${esc(event.title)}`,
    `STATUS:${event.status ?? "CONFIRMED"}`,
  ];
  const description = [event.description, event.organizerPhone ? `Contact: ${event.organizerPhone}` : null]
    .filter(Boolean)
    .join("\n");
  if (description) lines.push(`DESCRIPTION:${esc(description)}`);
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
  lines.push("BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Viewing reminder", "END:VALARM");
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Triggers a browser download of the calendar invite. */
export function downloadIcs(fileName: string, event: IcsEvent): void {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".ics") ? fileName : `${fileName}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
