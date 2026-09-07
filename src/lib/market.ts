/**
 * Market intelligence model.
 *
 * Turns seeded/live rental data into commercial opportunity estimates per
 * estate + corridor, and assigns an acquisition priority tier (A–D).
 * All assumptions live here so they are easy to tune.
 */

export type EstateStat = {
  estate: string;
  corridor: string;
  properties: number;
  units: number;
  occupied: number;
  vacant: number;
  landlords: number;
  tenants: number;
  avg_rent: number;
  monthly_rent: number;
  small_landlords: number;
  medium_landlords: number;
  large_landlords: number;
  institutional_landlords: number;
};

export const SEGMENTS = ["small", "medium", "large", "institutional"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABEL: Record<Segment, string> = {
  small: "Small (1–8 units)",
  medium: "Medium (9–40)",
  large: "Large (41–100)",
  institutional: "Institutional (100+)",
};

/** Tunable commercial assumptions. */
export const ASSUMPTIONS = {
  mpesaTakeRate: 0.01, // fee share on rent collected via M-PESA
  mpesaPenetration: 0.85, // share of rent likely to flow digitally
  depositMonths: 1, // deposit float per unit
  utilityBillPerTenant: 2500, // avg monthly water/power/garbage bill
  utilityTakeRate: 0.015,
  insurancePremiumPerUnit: 350, // monthly renters/landlord cover
  insuranceAttach: 0.2,
  lendingAdoption: 0.25, // tenants likely to take a rent advance
  lendingTicketOfRent: 0.4,
  lendingFee: 0.05,
};

export type Opportunity = {
  monthlyCollections: number;
  annualRentValue: number;
  depositFloat: number;
  mpesaRevenue: number;
  utilityRevenue: number;
  insuranceRevenue: number;
  lendingRevenue: number;
  totalMonthlyRevenue: number;
};

export function opportunityFor(rows: EstateStat[]): Opportunity {
  const units = sum(rows, (r) => r.units);
  const tenants = sum(rows, (r) => r.tenants);
  const collections = sum(rows, (r) => r.monthly_rent);
  const avgRent = units ? sum(rows, (r) => r.avg_rent * r.units) / units : 0;

  const a = ASSUMPTIONS;
  const mpesaRevenue = collections * a.mpesaPenetration * a.mpesaTakeRate;
  const utilityRevenue = tenants * a.utilityBillPerTenant * a.utilityTakeRate;
  const insuranceRevenue = units * a.insurancePremiumPerUnit * a.insuranceAttach;
  const lendingRevenue =
    tenants * a.lendingAdoption * avgRent * a.lendingTicketOfRent * a.lendingFee;

  return {
    monthlyCollections: collections,
    annualRentValue: collections * 12,
    depositFloat: units * avgRent * a.depositMonths,
    mpesaRevenue,
    utilityRevenue,
    insuranceRevenue,
    lendingRevenue,
    totalMonthlyRevenue: mpesaRevenue + utilityRevenue + insuranceRevenue + lendingRevenue,
  };
}

export type Tier = "A" | "B" | "C" | "D";

export type ScoredEstate = EstateStat & {
  score: number;
  tier: Tier;
  opportunity: Opportunity;
  occupancy: number;
};

/**
 * Opportunity index: blends scale (units), monetisable value (collections),
 * landlord density (acquisition efficiency) and occupancy quality.
 */
export function scoreEstates(rows: EstateStat[]): ScoredEstate[] {
  const maxUnits = Math.max(1, ...rows.map((r) => r.units));
  const maxRent = Math.max(1, ...rows.map((r) => r.monthly_rent));
  const maxLandlords = Math.max(1, ...rows.map((r) => r.landlords));

  const scored = rows.map((r) => {
    const opportunity = opportunityFor([r]);
    const occupancy = r.units ? r.occupied / r.units : 0;
    const unitsPerLandlord = r.landlords ? r.units / r.landlords : 0;
    const score =
      45 * (r.units / maxUnits) +
      30 * (r.monthly_rent / maxRent) +
      15 * (r.landlords / maxLandlords) +
      10 * Math.min(1, unitsPerLandlord / 20);
    return { ...r, score: Math.round(score * 10) / 10, tier: "D" as Tier, opportunity, occupancy };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  ranked.forEach((row, i) => {
    const pct = (i + 1) / ranked.length;
    row.tier = pct <= 0.15 ? "A" : pct <= 0.4 ? "B" : pct <= 0.7 ? "C" : "D";
  });
  return ranked;
}

export const TIER_COPY: Record<Tier, { label: string; hint: string }> = {
  A: { label: "Tier A", hint: "Land now — highest density and collectable value" },
  B: { label: "Tier B", hint: "Fast follow — strong volume, needs field reps" },
  C: { label: "Tier C", hint: "Nurture — self-serve onboarding and referrals" },
  D: { label: "Tier D", hint: "Monitor — low density, revisit next cycle" },
};

export function sum<T>(rows: T[], fn: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + (fn(r) || 0), 0);
}

export function segmentOf(units: number): Segment {
  if (units <= 8) return "small";
  if (units <= 40) return "medium";
  if (units <= 100) return "large";
  return "institutional";
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
