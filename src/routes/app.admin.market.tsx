import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKESShort, formatKES } from "@/lib/format";
import {
  type EstateStat,
  type Segment,
  SEGMENTS,
  SEGMENT_LABEL,
  TIER_COPY,
  downloadCsv,
  opportunityFor,
  scoreEstates,
  sum,
} from "@/lib/market";
import { Download, Target } from "lucide-react";

export const Route = createFileRoute("/app/admin/market")({
  component: MarketPage,
  head: () => ({
    meta: [
      { title: "Market intelligence · Makao360" },
      {
        name: "description",
        content:
          "Corridor and estate level rental market intelligence, opportunity index and acquisition tiers for Makao360.",
      },
    ],
  }),
});

const ALL = "__all__";

function MarketPage() {
  const { hasRole, loading } = useAuth();
  const [corridor, setCorridor] = useState<string>(ALL);
  const [segment, setSegment] = useState<string>(ALL);
  const [estateSearch, setEstateSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const stats = useQuery({
    queryKey: ["market-estate-stats"],
    enabled: !loading && hasRole("admin"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("market_estate_stats");
      if (error) throw error;
      return (data ?? []) as EstateStat[];
    },
  });

  const rows = useMemo(() => scoreEstates(stats.data ?? []), [stats.data]);

  const corridors = useMemo(
    () => Array.from(new Set(rows.map((r) => r.corridor))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (corridor !== ALL && r.corridor !== corridor) return false;
        if (estateSearch && !r.estate.toLowerCase().includes(estateSearch.toLowerCase()))
          return false;
        if (segment !== ALL) {
          const key = `${segment}_landlords` as const;
          const map: Record<Segment, number> = {
            small: r.small_landlords,
            medium: r.medium_landlords,
            large: r.large_landlords,
            institutional: r.institutional_landlords,
          };
          void key;
          if (!map[segment as Segment]) return false;
        }
        return true;
      }),
    [rows, corridor, segment, estateSearch],
  );

  const campaignRows = useMemo(
    () => (selected.length ? filtered.filter((r) => selected.includes(r.estate)) : filtered),
    [filtered, selected],
  );

  const opp = useMemo(() => opportunityFor(campaignRows), [campaignRows]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!hasRole("admin")) return <Navigate to="/app" />;

  const toggle = (estate: string) =>
    setSelected((s) => (s.includes(estate) ? s.filter((e) => e !== estate) : [...s, estate]));

  return (
    <div className="min-h-screen bg-background px-4 lg:px-8 py-6 max-w-7xl mx-auto">
      <PageHeader
        title="Market intelligence"
        description="Rental units → landlords → tenants by corridor, with product opportunity and acquisition tiers."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/admin">Back to admin</Link>
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "makao360-market-insight.csv",
                  rows.map((r) => ({
                    estate: r.estate,
                    corridor: r.corridor,
                    tier: r.tier,
                    score: r.score,
                    properties: r.properties,
                    units: r.units,
                    occupied: r.occupied,
                    vacant: r.vacant,
                    occupancy_pct: Math.round(r.occupancy * 100),
                    landlords: r.landlords,
                    tenants: r.tenants,
                    small_landlords: r.small_landlords,
                    medium_landlords: r.medium_landlords,
                    large_landlords: r.large_landlords,
                    institutional_landlords: r.institutional_landlords,
                    avg_rent: r.avg_rent,
                    monthly_collections: r.opportunity.monthlyCollections,
                    annual_rent_value: r.opportunity.annualRentValue,
                    deposit_float: Math.round(r.opportunity.depositFloat),
                    mpesa_revenue: Math.round(r.opportunity.mpesaRevenue),
                    utility_revenue: Math.round(r.opportunity.utilityRevenue),
                    insurance_revenue: Math.round(r.opportunity.insuranceRevenue),
                    lending_revenue: Math.round(r.opportunity.lendingRevenue),
                  })),
                )
              }
            >
              <Download className="size-4 mr-1.5" /> Export report
            </Button>
          </div>
        }
      />

      {stats.isLoading ? (
        <div className="text-sm text-muted-foreground">Crunching the market…</div>
      ) : stats.error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          {(stats.error as Error).message}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Estates covered" value={rows.length} />
            <StatCard label="Rental units" value={sum(rows, (r) => r.units).toLocaleString()} tone="primary" />
            <StatCard label="Landlords" value={sum(rows, (r) => r.landlords).toLocaleString()} />
            <StatCard label="Tenant households" value={sum(rows, (r) => r.tenants).toLocaleString()} tone="success" />
          </div>

          {/* Filters */}
          <div className="rounded-2xl border bg-card p-4 mb-6 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground">Corridor</label>
              <Select value={corridor} onValueChange={setCorridor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All corridors</SelectItem>
                  {corridors.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground">Landlord segment present</label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All segments</SelectItem>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="text-xs text-muted-foreground">Search estate</label>
              <Input
                value={estateSearch}
                onChange={(e) => setEstateSearch(e.target.value)}
                placeholder="e.g. Pipeline"
              />
            </div>
            {selected.length > 0 && (
              <Button variant="ghost" onClick={() => setSelected([])}>
                Clear {selected.length} selected
              </Button>
            )}
          </div>

          {/* Campaign projection */}
          <section className="rounded-2xl border bg-card p-6 mb-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center">
                <Target className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">Campaign projection</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.length
                    ? `${selected.length} estate${selected.length === 1 ? "" : "s"} selected`
                    : `All ${campaignRows.length} estates in the current filter`}{" "}
                  · monthly product potential at current occupancy.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric label="Rent collections / mo" value={formatKESShort(opp.monthlyCollections)} tone="primary" />
              <Metric label="Annual rental value" value={formatKESShort(opp.annualRentValue)} />
              <Metric label="Deposit float" value={formatKESShort(opp.depositFloat)} />
              <Metric label="M-PESA revenue / mo" value={formatKESShort(opp.mpesaRevenue)} tone="success" />
              <Metric label="Utilities revenue / mo" value={formatKESShort(opp.utilityRevenue)} />
              <Metric label="Insurance revenue / mo" value={formatKESShort(opp.insuranceRevenue)} />
              <Metric label="Lending revenue / mo" value={formatKESShort(opp.lendingRevenue)} />
              <Metric label="Total platform revenue / mo" value={formatKESShort(opp.totalMonthlyRevenue)} tone="success" />
            </div>
          </section>

          <Tabs defaultValue="index">
            <TabsList>
              <TabsTrigger value="index">Opportunity index</TabsTrigger>
              <TabsTrigger value="corridors">Corridor rollup</TabsTrigger>
              <TabsTrigger value="landlords">Landlords</TabsTrigger>
              <TabsTrigger value="tenants">Tenants</TabsTrigger>
            </TabsList>

            <TabsContent value="index">
              <div className="rounded-2xl border bg-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Estate</th>
                      <th className="text-left p-3">Corridor</th>
                      <th className="text-right p-3">Units</th>
                      <th className="text-right p-3">Occ.</th>
                      <th className="text-right p-3">Landlords</th>
                      <th className="text-right p-3">Tenants</th>
                      <th className="text-right p-3">Avg rent</th>
                      <th className="text-right p-3">Collections/mo</th>
                      <th className="text-right p-3">Platform rev/mo</th>
                      <th className="text-center p-3">Tier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={`${r.estate}-${r.corridor}`}
                        onClick={() => toggle(r.estate)}
                        className={`border-t cursor-pointer hover:bg-muted/40 ${
                          selected.includes(r.estate) ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="p-3 font-medium">{r.estate}</td>
                        <td className="p-3 text-muted-foreground">{r.corridor}</td>
                        <td className="p-3 text-right">{r.units.toLocaleString()}</td>
                        <td className="p-3 text-right">{Math.round(r.occupancy * 100)}%</td>
                        <td className="p-3 text-right">{r.landlords}</td>
                        <td className="p-3 text-right">{r.tenants}</td>
                        <td className="p-3 text-right">{formatKES(Number(r.avg_rent))}</td>
                        <td className="p-3 text-right">{formatKESShort(r.opportunity.monthlyCollections)}</td>
                        <td className="p-3 text-right">{formatKESShort(r.opportunity.totalMonthlyRevenue)}</td>
                        <td className="p-3 text-center">
                          <Badge
                            variant={r.tier === "A" ? "default" : r.tier === "B" ? "secondary" : "outline"}
                            title={TIER_COPY[r.tier].hint}
                          >
                            {r.tier}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No estates match these filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click a row to add it to the campaign projection. Tier A = top 15% by opportunity score.
              </p>
            </TabsContent>

            <TabsContent value="corridors">
              <CorridorRollup rows={filtered} />
            </TabsContent>

            <TabsContent value="landlords">
              <LandlordDirectory corridors={corridors} />
            </TabsContent>

            <TabsContent value="tenants">
              <TenantDirectory corridors={corridors} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function CorridorRollup({ rows }: { rows: ReturnType<typeof scoreEstates> }) {
  const byCorridor = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach((r) => {
      map.set(r.corridor, [...(map.get(r.corridor) ?? []), r]);
    });
    return Array.from(map.entries())
      .map(([corridor, list]) => ({
        corridor,
        estates: list.length,
        units: sum(list, (r) => r.units),
        landlords: sum(list, (r) => r.landlords),
        tenants: sum(list, (r) => r.tenants),
        small: sum(list, (r) => r.small_landlords),
        medium: sum(list, (r) => r.medium_landlords),
        large: sum(list, (r) => r.large_landlords),
        institutional: sum(list, (r) => r.institutional_landlords),
        opp: opportunityFor(list),
      }))
      .sort((a, b) => b.units - a.units);
  }, [rows]);

  return (
    <div className="rounded-2xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="text-left p-3">Corridor</th>
            <th className="text-right p-3">Estates</th>
            <th className="text-right p-3">Units</th>
            <th className="text-right p-3">Landlords</th>
            <th className="text-right p-3">Tenants</th>
            <th className="text-right p-3">S / M / L / Inst</th>
            <th className="text-right p-3">Collections/mo</th>
            <th className="text-right p-3">Annual value</th>
          </tr>
        </thead>
        <tbody>
          {byCorridor.map((c) => (
            <tr key={c.corridor} className="border-t">
              <td className="p-3 font-medium">{c.corridor}</td>
              <td className="p-3 text-right">{c.estates}</td>
              <td className="p-3 text-right">{c.units.toLocaleString()}</td>
              <td className="p-3 text-right">{c.landlords.toLocaleString()}</td>
              <td className="p-3 text-right">{c.tenants.toLocaleString()}</td>
              <td className="p-3 text-right text-muted-foreground">
                {c.small} / {c.medium} / {c.large} / {c.institutional}
              </td>
              <td className="p-3 text-right">{formatKESShort(c.opp.monthlyCollections)}</td>
              <td className="p-3 text-right">{formatKESShort(c.opp.annualRentValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type LandlordRow = {
  landlord_id: string;
  full_name: string | null;
  phone: string | null;
  corridors: string[];
  estates: string[];
  properties: number;
  units: number;
  occupied: number;
  monthly_rent: number;
  segment: string;
};

function LandlordDirectory({ corridors }: { corridors: string[] }) {
  const [corridor, setCorridor] = useState(ALL);
  const [segment, setSegment] = useState(ALL);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-landlord-directory", corridor, segment, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_landlord_directory", {
        _corridor: corridor === ALL ? undefined : corridor,
        _segment: segment === ALL ? undefined : segment,
        _search: search || undefined,
        _limit: 300,
      });
      if (error) throw error;
      return (data ?? []) as LandlordRow[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={corridor} onValueChange={setCorridor}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All corridors</SelectItem>
            {corridors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All segments</SelectItem>
            {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{SEGMENT_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="w-[240px]"
          placeholder="Search name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => downloadCsv("makao360-landlords.csv", (q.data ?? []) as unknown as Record<string, unknown>[])}
        >
          <Download className="size-4 mr-1.5" /> Export
        </Button>
      </div>
      <div className="rounded-2xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Landlord</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Corridors</th>
              <th className="text-right p-3">Properties</th>
              <th className="text-right p-3">Units</th>
              <th className="text-right p-3">Occupied</th>
              <th className="text-right p-3">Collections/mo</th>
              <th className="text-left p-3">Segment</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {(q.data ?? []).map((l) => (
              <tr key={l.landlord_id} className="border-t">
                <td className="p-3 font-medium">{l.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.phone ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{(l.corridors ?? []).join(", ")}</td>
                <td className="p-3 text-right">{l.properties}</td>
                <td className="p-3 text-right">{l.units}</td>
                <td className="p-3 text-right">{l.occupied}</td>
                <td className="p-3 text-right">{formatKESShort(l.monthly_rent)}</td>
                <td className="p-3"><Badge variant="secondary">{l.segment}</Badge></td>
              </tr>
            ))}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No landlords match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type TenantRow = {
  tenant_id: string;
  full_name: string | null;
  phone: string | null;
  corridor: string;
  estate: string;
  property_name: string;
  unit_label: string;
  rent_amount: number;
  lease_status: string;
  landlord_name: string | null;
};

function TenantDirectory({ corridors }: { corridors: string[] }) {
  const [corridor, setCorridor] = useState(ALL);
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-tenant-directory", corridor, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_tenant_directory", {
        _corridor: corridor === ALL ? undefined : corridor,
        _estate: undefined,
        _search: search || undefined,
        _limit: 300,
      });
      if (error) throw error;
      return (data ?? []) as TenantRow[];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={corridor} onValueChange={setCorridor}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All corridors</SelectItem>
            {corridors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="w-[240px]"
          placeholder="Search tenant, phone or property"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => downloadCsv("makao360-tenants.csv", (q.data ?? []) as unknown as Record<string, unknown>[])}
        >
          <Download className="size-4 mr-1.5" /> Export
        </Button>
      </div>
      <div className="rounded-2xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Tenant</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Estate</th>
              <th className="text-left p-3">Property · unit</th>
              <th className="text-right p-3">Rent</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Landlord</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {(q.data ?? []).map((t, i) => (
              <tr key={`${t.tenant_id}-${i}`} className="border-t">
                <td className="p-3 font-medium">{t.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{t.phone ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{t.estate} · {t.corridor}</td>
                <td className="p-3">{t.property_name} · {t.unit_label}</td>
                <td className="p-3 text-right">{formatKES(t.rent_amount)}</td>
                <td className="p-3"><Badge variant="outline">{t.lease_status}</Badge></td>
                <td className="p-3 text-muted-foreground">{t.landlord_name ?? "—"}</td>
              </tr>
            ))}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No tenants match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "primary" | "success" }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === "primary" ? "bg-primary/5 border-primary/30" : tone === "success" ? "bg-success/5 border-success/30" : "bg-muted/30"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </div>
  );
}
