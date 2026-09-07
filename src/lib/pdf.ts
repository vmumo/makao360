import jsPDF from "jspdf";
import { formatKES, formatDate, formatDateTime } from "@/lib/format";

export type StatementInput = {
  property: string;
  unit: string;
  address: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  landlordName: string | null;
  landlordPhone: string | null;
  cycle: {
    period_start: string;
    period_end: string;
    due_date: string;
    target_amount: number;
    accumulated_amount: number;
    status: string;
  };
  contributions: {
    amount: number;
    contributed_at: string;
    mpesa_receipt: string | null;
    payer_phone: string | null;
  }[];
};

export function generateRentStatementPdf(s: StatementInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Brand band
  doc.setFillColor(20, 28, 64); // navy
  doc.rect(0, 0, pageW, 90, "F");
  doc.setFillColor(67, 165, 75); // green
  doc.rect(0, 90, pageW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Makao360", margin, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Rent statement", margin, 70);

  doc.setFontSize(9);
  const issued = `Issued ${formatDateTime(new Date().toISOString())}`;
  doc.text(issued, pageW - margin - doc.getTextWidth(issued), 70);

  y = 130;
  doc.setTextColor(20, 28, 64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${s.property} — Unit ${s.unit}`, margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 110);
  if (s.address) { doc.text(s.address, margin, y); y += 14; }

  y += 10;
  // Two-column meta
  const colW = (pageW - margin * 2) / 2;
  doc.setTextColor(20, 28, 64);
  doc.setFont("helvetica", "bold");
  doc.text("Tenant", margin, y);
  doc.text("Landlord", margin + colW, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 60);
  doc.text(s.tenantName ?? "—", margin, y + 14);
  doc.text(s.tenantPhone ?? "—", margin, y + 28);
  doc.text(s.landlordName ?? "—", margin + colW, y + 14);
  doc.text(s.landlordPhone ?? "—", margin + colW, y + 28);
  y += 50;

  // Cycle box
  doc.setDrawColor(220, 224, 235);
  doc.setFillColor(247, 248, 252);
  doc.roundedRect(margin, y, pageW - margin * 2, 88, 8, 8, "FD");
  doc.setTextColor(20, 28, 64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Rent cycle", margin + 16, y + 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 80);
  doc.text(
    `${formatDate(s.cycle.period_start)}  →  ${formatDate(s.cycle.period_end)}`,
    margin + 16,
    y + 40,
  );
  doc.text(`Due: ${formatDate(s.cycle.due_date)}`, margin + 16, y + 56);
  doc.text(`Status: ${s.cycle.status}`, margin + 16, y + 72);

  // Right side numbers
  const rightX = pageW - margin - 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 110);
  const labels = ["Target", "Paid", "Balance"];
  const values = [
    formatKES(s.cycle.target_amount),
    formatKES(s.cycle.accumulated_amount),
    formatKES(Math.max(0, s.cycle.target_amount - s.cycle.accumulated_amount)),
  ];
  labels.forEach((l, i) => {
    const ly = y + 22 + i * 18;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 110);
    doc.text(l, rightX - 140, ly);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 28, 64);
    doc.text(values[i], rightX - doc.getTextWidth(values[i]), ly);
  });
  y += 110;

  // Contributions table
  doc.setTextColor(20, 28, 64);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Contributions", margin, y);
  y += 12;

  doc.setFillColor(20, 28, 64);
  doc.rect(margin, y, pageW - margin * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Date", margin + 10, y + 14);
  doc.text("Receipt", margin + 180, y + 14);
  doc.text("Phone", margin + 320, y + 14);
  doc.text("Amount", pageW - margin - 10 - doc.getTextWidth("Amount"), y + 14);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 60);
  if (!s.contributions.length) {
    doc.text("No contributions yet for this cycle.", margin + 10, y + 16);
    y += 30;
  } else {
    s.contributions.forEach((c, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(248, 249, 252);
        doc.rect(margin, y, pageW - margin * 2, 22, "F");
      }
      doc.setTextColor(40, 40, 60);
      doc.text(formatDateTime(c.contributed_at), margin + 10, y + 14);
      doc.text(c.mpesa_receipt ?? "—", margin + 180, y + 14);
      doc.text(c.payer_phone ?? "—", margin + 320, y + 14);
      const amt = formatKES(c.amount);
      doc.text(amt, pageW - margin - 10 - doc.getTextWidth(amt), y + 14);
      y += 22;
      if (y > 760) { doc.addPage(); y = margin; }
    });
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 36;
  doc.setDrawColor(220, 224, 235);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 135);
  doc.text("Makao360 — Flexible rent. Better records. Less stress.", margin, footerY + 14);
  const ref = `Ref: ${s.cycle.period_start.slice(0, 7)}/${s.unit}`;
  doc.text(ref, pageW - margin - doc.getTextWidth(ref), footerY + 14);

  return doc;
}
