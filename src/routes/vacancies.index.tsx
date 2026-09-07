import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, MapPin, Search, Building2 } from "lucide-react";
import { MarketingHeader, MarketingFooter } from "@/components/MarketingChrome";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/vacancies/")({
  head: () => ({
    meta: [
      { title: "Vacant houses to rent in Kenya — Makao360" },
      { name: "description", content: "Browse verified vacant units with rent, deposit, location and photos. Apply online in minutes on Makao360." },
      { property: "og:title", content: "Vacancies on Makao360" },
      { property: "og:description", content: "Verified vacant rentals with transparent rent and deposit. Apply online." },
      { property: "og:image", content: "https://makao-360-hub.lovable.app/og-product.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://makao-360-hub.lovable.app/og-product.jpg" },
      { name: "twitter:title", content: "Vacancies on Makao360" },
      { name: "twitter:description", content: "Verified vacant rentals with transparent rent and deposit. Apply online." },
    ],
  }),
  component: VacanciesPage,
});

type Vacancy = {
  unit_id: string;
  label: string;
  rent_amount: number;
  deposit_amount: number;
  bedrooms: number | null;
  listing_title: string | null;
  listing_photos: string[] | null;
  listing_amenities: string[] | null;
  available_from: string | null;
  property_name: string;
  city: string | null;
  county: string | null;
  address: string | null;
  viewing_slots?: number | null;
};

const PROPERTY_TYPES = [
  "apartment", "bedsitter", "studio", "maisonette", "bungalow", "commercial", "mixed_use",
] as const;

type Filters = {
  search: string;
  county: string;
  minRent: string;
  maxRent: string;
  bedrooms: string;
  propertyType: string;
};

const EMPTY: Filters = { search: "", county: "", minRent: "", maxRent: "", bedrooms: "any", propertyType: "any" };

function VacanciesPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ["public-vacancies", applied],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_vacancies", {
        _search: applied.search || undefined,
        _county: applied.county || undefined,
        _min_rent: applied.minRent ? Number(applied.minRent) : undefined,
        _max_rent: applied.maxRent ? Number(applied.maxRent) : undefined,
        _bedrooms: applied.bedrooms !== "any" ? Number(applied.bedrooms) : undefined,
        _property_type: applied.propertyType !== "any" ? (applied.propertyType as (typeof PROPERTY_TYPES)[number]) : undefined,
        _limit: 60,
      });
      if (error) throw error;
      return (data ?? []) as Vacancy[];
    },
  });

  const rents = (data ?? []).map((v) => v.rent_amount);
  const range = rents.length ? `${formatKES(Math.min(...rents))} – ${formatKES(Math.max(...rents))}` : "—";
  const set = (k: keyof Filters, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="mx-auto max-w-7xl px-6 pt-16 pb-10">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Vacant houses on Makao360</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Verified landlords, transparent rent and deposit, and an application you can complete online.
          Rent range currently listed: <span className="font-medium text-foreground">{range}</span>.
        </p>

        <form
          className="mt-6 rounded-2xl border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
          }}
        >
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Estate, town or property name"
                value={draft.search}
                onChange={(e) => set("search", e.target.value)}
                aria-label="Search vacancies"
              />
            </div>
            <Input
              placeholder="County"
              value={draft.county}
              onChange={(e) => set("county", e.target.value)}
              aria-label="County"
            />
            <Select value={draft.propertyType} onValueChange={(v) => set("propertyType", v)}>
              <SelectTrigger aria-label="Unit type"><SelectValue placeholder="Unit type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any unit type</SelectItem>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={draft.bedrooms} onValueChange={(v) => set("bedrooms", v)}>
              <SelectTrigger aria-label="Bedrooms"><SelectValue placeholder="Bedrooms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any bedrooms</SelectItem>
                {[0, 1, 2, 3, 4, 5].map((b) => (
                  <SelectItem key={b} value={String(b)}>{b === 0 ? "Studio / bedsitter" : `${b} bed`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number" min={0} placeholder="Min rent"
                value={draft.minRent} onChange={(e) => set("minRent", e.target.value)} aria-label="Minimum rent"
              />
              <Input
                type="number" min={0} placeholder="Max rent"
                value={draft.maxRent} onChange={(e) => set("maxRent", e.target.value)} aria-label="Maximum rent"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit">Search</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setDraft(EMPTY); setApplied(EMPTY); }}
            >
              Reset filters
            </Button>
          </div>
        </form>
      </section>


      <section className="mx-auto max-w-7xl px-6 pb-24">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading vacancies…</div>
        ) : !data || data.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Building2 className="size-8 mx-auto text-muted-foreground" />
            <h2 className="mt-3 font-display font-semibold">No matching vacancies</h2>
            <p className="text-sm text-muted-foreground mt-1">Try a wider search or a higher rent ceiling.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((v) => {
              const photo = v.listing_photos?.[0];
              return (
                <Link
                  key={v.unit_id}
                  to="/vacancies/$unitId"
                  params={{ unitId: v.unit_id }}
                  className="group rounded-2xl border bg-card overflow-hidden hover:border-accent transition"
                >
                  <div className="aspect-[4/3] bg-muted overflow-hidden">
                    {photo ? (
                      <img
                        src={photo}
                        alt={`${v.property_name} unit ${v.label} in ${v.city ?? "Kenya"}`}
                        loading="lazy"
                        className="size-full object-cover group-hover:scale-105 transition"
                      />
                    ) : (
                      <div className="size-full grid place-items-center text-muted-foreground">
                        <Building2 className="size-8" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display font-semibold leading-tight">
                        {v.listing_title ?? `${v.property_name} · ${v.label}`}
                      </h2>
                      <Badge variant="secondary">{formatKES(v.rent_amount)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden="true" /> {v.city ?? v.county ?? "Kenya"}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BedDouble className="size-3.5" aria-hidden="true" /> {v.bedrooms ?? "—"} bed
                      </span>
                      <span>Deposit {formatKES(v.deposit_amount)}</span>
                      <span>From {formatDate(v.available_from)}</span>
                      {(v.viewing_slots ?? 0) > 0 && (
                        <Badge variant="outline">{v.viewing_slots} viewing slot{v.viewing_slots === 1 ? "" : "s"}</Badge>
                      )}

                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <MarketingFooter />
    </div>
  );
}
