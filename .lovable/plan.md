# Makao360 — Core Capability Upgrade

Shipping in four batches. Each batch is one turn; I'll pause between batches so you can QA.

## Batch 1 — Portfolio Map & Clustering (demo hero)

**What you'll see**
- New `/app/landlord/map` route: full-height Google Map with all properties as pins, clustered when zoomed out.
- Pin color = occupancy status (green = full, amber = partial, red = vacant, grey = no units).
- Click a cluster → zooms in. Click a pin → side sheet with property KPIs (units, occupied, arrears, MoM revenue) + "Open property" link.
- Filter bar: portfolio, tag, occupancy status, arrears threshold.
- Admin gets `/app/admin/map` — same map, all landlords, colored by landlord.

**Technical**
- Google Maps JS API via managed browser key (`VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`).
- `@googlemaps/markerclusterer` for clustering.
- Migration: add `latitude`, `longitude`, `address_line` columns to `properties` (nullable). Backfill: geocode existing properties on-demand via Google Geocoding through the gateway when a property is opened without coords (or a "Geocode all" admin action).
- New server fn `getPropertiesForMap` returns aggregated KPIs per property (occupied count, arrears total, current-month revenue) in one query.

## Batch 2 — Analytics Dashboards

**Landlord `/app/landlord/analytics`**
- KPI cards: Collection rate (30d), Occupancy %, Total arrears, MoM revenue delta, Active Fuliza exposure.
- Charts (Recharts):
  - Revenue trend (12 months, area chart)
  - Collection rate by property (bar)
  - Arrears aging bucket (0–30, 31–60, 61–90, 90+) stacked bar
  - Occupancy timeline
  - Fuliza repayment aging
- Top 5 / bottom 5 properties by yield table.

**Admin `/app/admin/analytics`**
- Platform-wide GMV, active landlords, tenants, contribution volume, Fuliza outstanding, KYC funnel, maintenance SLA.

**Technical**
- SQL functions `landlord_dashboard_metrics(_landlord_id)` and `admin_platform_metrics()` returning JSON — pre-aggregated to keep the page snappy.
- Query with TanStack Query, 60s stale time.

## Batch 3 — UI Refresh + Command Palette

- Redesigned landlord overview: hero KPI strip + map preview card + recent activity feed + collection sparkline.
- ⌘K command palette (cmdk) — jump to property, tenant, invite, reconcile, mark all read, switch theme.
- Skeleton loaders on all list pages (properties, tenants, payments, maintenance).
- Empty-state illustrations (inline SVG, brand-toned).
- Motion polish: stagger on card grids, subtle number counters on KPIs.
- Notification toasts upgraded with action buttons ("View", "Mark read").

## Batch 4 — Operational Depth

- **Maintenance v2:** photo upload to Supabase storage, SLA timer (days since open, color-graded), in-thread comments (tenant ↔ landlord), status audit trail.
- **In-house tenant screening:** trust score derived from `contributions` (on-time %), `rent_advances` (repaid vs. defaulted), `kyc_submissions` (verified?), `leases` (tenure). Shown on tenant profile + invite acceptance flow.
- **Owner statements PDF:** per-property monthly PDF (jsPDF) — opening balance, contributions list, payouts, closing balance, arrears. Downloadable from property page.
- **Notification digest:** daily/weekly toggle in preferences (no email transport yet — writes to `notifications` as a rolled-up entry).

## Out of scope (flagged earlier, still deferred)
- Live M-Pesa Daraja
- Sentry / PostHog SDK wiring (needs your DSN/key)
- WhatsApp Business API
- KYC vendor integration (Smile ID)
- Public listing pages (SEO'd vacant units) — proposed but not selected

## Approve or edit
Say **"go"** and I'll start Batch 1 (map). Or tell me to reorder, drop, or expand any batch.
