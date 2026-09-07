/// <reference types="leaflet.markercluster" />
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { formatKES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Building2, MapPin, Home, TrendingUp, AlertCircle, Layers, Filter } from "lucide-react";

// Fix Leaflet's default icon paths under Vite bundling
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type MapProperty = {
  property_id: string;
  landlord_id: string;
  name: string;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  portfolio_id: string | null;
  units_total: number;
  units_occupied: number;
  units_vacant: number;
  arrears_total: number;
  revenue_30d: number;
};

type Status = "full" | "partial" | "vacant" | "empty";

function occupancyStatus(p: MapProperty): Status {
  if (p.units_total === 0) return "empty";
  if (p.units_occupied === 0) return "vacant";
  if (p.units_occupied === p.units_total) return "full";
  return "partial";
}

const STATUS_COLOR: Record<Status, string> = {
  full: "#16a34a",
  partial: "#f59e0b",
  vacant: "#dc2626",
  empty: "#6b7280",
};

const STATUS_LABEL: Record<Status, string> = {
  full: "Fully occupied",
  partial: "Partially occupied",
  vacant: "Vacant",
  empty: "No units",
};

function buildPinIcon(color: string, count: number) {
  const html = `
    <div style="
      width:34px;height:44px;position:relative;
      display:flex;align-items:center;justify-content:center;
    ">
      <svg viewBox="0 0 32 42" width="34" height="44" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.2 0 0 7.2 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.2 24.8 0 16 0z"
              fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="9" fill="white"/>
      </svg>
      <span style="
        position:absolute;top:6px;left:0;right:0;text-align:center;
        color:${color};font-weight:800;font-size:12px;font-family:system-ui;
      ">${count}</span>
    </div>`;
  return L.divIcon({
    html,
    className: "makao-pin",
    iconSize: [34, 44],
    iconAnchor: [17, 42],
    popupAnchor: [0, -36],
  });
}

export function PropertyMap({
  scope = "landlord",
}: {
  scope?: "landlord" | "admin";
}) {
  const { hasRole } = useAuth();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const [selected, setSelected] = useState<MapProperty | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [minArrears, setMinArrears] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["property-map", scope],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("landlord_property_map", {
        _landlord_id: undefined as unknown as string,
      });
      if (error) throw error;
      return (data ?? []) as MapProperty[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((p) => {
      if (!p.latitude || !p.longitude) return false;
      if (statusFilter !== "all" && occupancyStatus(p) !== statusFilter) return false;
      if (p.arrears_total < minArrears) return false;
      return true;
    });
  }, [data, statusFilter, minArrears]);

  // Init the map once
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [-1.2921, 36.8219],
      zoom: 7,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
    };
  }, []);

  // Rebuild markers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filtered.length) {
      if (clusterRef.current) {
        clusterRef.current.clearLayers();
      }
      return;
    }

    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
    }
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 55,
      iconCreateFunction: (c) => {
        const count = c.getChildCount();
        const size = count < 10 ? 36 : count < 50 ? 44 : 54;
        return L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:rgba(20,83,45,0.9);color:white;
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-family:system-ui;font-size:${count < 100 ? 14 : 12}px;
            border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.25);
          ">${count}</div>`,
          className: "makao-cluster",
          iconSize: [size, size],
        });
      },
    });

    for (const p of filtered) {
      const status = occupancyStatus(p);
      const marker = L.marker([p.latitude!, p.longitude!], {
        icon: buildPinIcon(STATUS_COLOR[status], p.units_total),
      });
      marker.on("click", () => setSelected(p));
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    clusterRef.current = cluster;

    // Fit bounds
    const bounds = cluster.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [filtered]);

  const totals = useMemo(() => {
    if (!data) return { properties: 0, units: 0, occupied: 0, arrears: 0, revenue: 0 };
    return data.reduce(
      (acc, p) => ({
        properties: acc.properties + 1,
        units: acc.units + p.units_total,
        occupied: acc.occupied + p.units_occupied,
        arrears: acc.arrears + p.arrears_total,
        revenue: acc.revenue + p.revenue_30d,
      }),
      { properties: 0, units: 0, occupied: 0, arrears: 0, revenue: 0 },
    );
  }, [data]);

  return (
    <div className="relative rounded-2xl border overflow-hidden bg-card">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center gap-1.5 text-sm font-medium mr-2">
          <Filter className="size-4" />
          Filters
        </div>
        <div className="inline-flex rounded-lg border bg-background p-0.5 text-xs">
          {(["all", "full", "partial", "vacant", "empty"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-muted-foreground">Min arrears</label>
          <select
            value={minArrears}
            onChange={(e) => setMinArrears(Number(e.target.value))}
            className="bg-background border rounded-md px-2 py-1"
          >
            <option value={0}>Any</option>
            <option value={5000}>KES 5k+</option>
            <option value={20000}>KES 20k+</option>
            <option value={50000}>KES 50k+</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <LegendDot color={STATUS_COLOR.full} label="Full" />
          <LegendDot color={STATUS_COLOR.partial} label="Partial" />
          <LegendDot color={STATUS_COLOR.vacant} label="Vacant" />
          <LegendDot color={STATUS_COLOR.empty} label="Empty" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border">
        <MiniStat icon={<Building2 className="size-4" />} label="Properties" value={totals.properties} />
        <MiniStat icon={<Home className="size-4" />} label="Units" value={totals.units} />
        <MiniStat
          icon={<Layers className="size-4" />}
          label="Occupancy"
          value={totals.units ? `${Math.round((totals.occupied / totals.units) * 100)}%` : "—"}
        />
        <MiniStat
          icon={<AlertCircle className="size-4 text-warning-foreground" />}
          label="Arrears"
          value={formatKES(totals.arrears)}
        />
        <MiniStat
          icon={<TrendingUp className="size-4 text-success" />}
          label="30-day revenue"
          value={formatKES(totals.revenue)}
        />
      </div>

      {/* Map canvas */}
      <div className="relative">
        <div ref={mapEl} className="w-full h-[68vh] min-h-[520px] z-0" />
        {isLoading && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 z-[500] pointer-events-none">
            <div className="text-sm text-muted-foreground">Loading properties…</div>
          </div>
        )}
        {!isLoading && !filtered.length && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 pointer-events-none">
            <div className="text-center max-w-xs px-6">
              <MapPin className="size-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No properties match your filters</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adjust filters above or add coordinates to your properties.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display flex items-center gap-2">
                  <Building2 className="size-5" />
                  {selected.name}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1 text-xs">
                  <MapPin className="size-3" />
                  {selected.address ?? ""}{selected.address ? ", " : ""}{selected.city}
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    style={{ backgroundColor: STATUS_COLOR[occupancyStatus(selected)], color: "white" }}
                  >
                    {STATUS_LABEL[occupancyStatus(selected)]}
                  </Badge>
                  {selected.arrears_total > 0 && (
                    <Badge variant="destructive">{formatKES(selected.arrears_total)} arrears</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SheetStat label="Units" value={selected.units_total} />
                  <SheetStat label="Occupied" value={`${selected.units_occupied}/${selected.units_total}`} />
                  <SheetStat label="Vacant" value={selected.units_vacant} />
                  <SheetStat label="Revenue (30d)" value={formatKES(selected.revenue_30d)} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button asChild className="flex-1">
                    <Link
                      to="/app/landlord/properties/$propertyId"
                      params={{ propertyId: selected.property_id }}
                    >
                      Open property
                    </Link>
                  </Button>
                  {hasRole("landlord") && (
                    <Button asChild variant="outline">
                      <Link to="/app/landlord/tenants">Tenants</Link>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold">{value}</div>
    </div>
  );
}

function SheetStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/30">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
