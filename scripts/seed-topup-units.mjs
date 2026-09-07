import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Use raw query via PostgREST: get props with no units
const { data: props } = await sb
  .from("properties")
  .select("id, landlord_id, units(id)")
  .limit(2000);

const landlordsNoUnits = new Map();
for (const p of props) {
  const has = p.units && p.units.length > 0;
  if (!has) {
    if (!landlordsNoUnits.has(p.landlord_id)) landlordsNoUnits.set(p.landlord_id, []);
    landlordsNoUnits.get(p.landlord_id).push(p.id);
  } else {
    landlordsNoUnits.delete(p.landlord_id);
  }
}
// Actually need: landlords where ALL props have no units
const landlordHasUnits = new Set();
for (const p of props) if (p.units && p.units.length > 0) landlordHasUnits.add(p.landlord_id);
const targets = [...landlordsNoUnits.entries()].filter(([lid]) => !landlordHasUnits.has(lid));
console.log("Landlords needing units:", targets.length);

const randInt = (lo, hi) => Math.floor(Math.random()*(hi-lo+1))+lo;

for (const [lid, propIds] of targets) {
  const propId = propIds[0];
  const labels = new Set();
  const rows = [];
  while (rows.length < 4) {
    const label = `U${randInt(100,999)}`;
    if (labels.has(label)) continue;
    labels.add(label);
    const rent = randInt(8,40)*1000;
    rows.push({ property_id: propId, label, rent_amount: rent, deposit_amount: rent, bedrooms: randInt(1,3) });
  }
  const { error } = await sb.from("units").insert(rows);
  if (error) console.error(lid, error.message);
}
console.log("done");
