import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const PASSWORD = "MakaoDemo2026!";
const NUM_LANDLORDS = 100;
const NUM_TENANTS = 1000;

const firstNames = ["Amani","Baraka","Chebet","Daudi","Esther","Faraja","Gathoni","Hawa","Imani","Juma","Kamau","Lulu","Mumbi","Neema","Otieno","Pendo","Qamar","Rehema","Salma","Tatu","Uhuru","Wambui","Yusuf","Zawadi","Achieng","Bahati","Cheruiyot","Dalia","Ekene","Fatuma","Githinji","Halima","Ireri","Jabari","Kioko","Lwanga","Mwangi","Nia","Onyango","Pili","Ramla","Sifa","Taifa","Upendo","Vumilia","Waweru","Yoweri","Zuri","Adila","Bina"];
const lastNames = ["Kariuki","Mwangi","Otieno","Wanjiku","Kamau","Ochieng","Hassan","Njoroge","Achieng","Kimani","Mutua","Wafula","Maina","Ouma","Kilonzo","Cheruiyot","Korir","Owino","Kibet","Nyongo","Wekesa","Akinyi","Barasa","Chumo","Diba","Etemesi"];
const cities = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Kiambu","Machakos","Nyeri","Naivasha"];
const propTypes = ["apartment","bungalow","maisonette","studio","bedsitter"];

const rand = (a) => a[Math.floor(Math.random()*a.length)];
const randInt = (lo, hi) => Math.floor(Math.random()*(hi-lo+1))+lo;
const pad = (n, w) => String(n).padStart(w,"0");

async function createBatch(count, prefix, role, startIdx=1) {
  const out = [];
  const concurrency = 20;
  let i = 0;
  async function worker() {
    while (true) {
      const idx = i++;
      if (idx >= count) return;
      const n = startIdx + idx;
      const email = `${prefix}${pad(n,4)}@makao360.demo`;
      const fullName = `${rand(firstNames)} ${rand(lastNames)}`;
      const phone = `2547${pad(randInt(0,99999999),8)}`;
      const { data, error } = await sb.auth.admin.createUser({
        email, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: fullName, phone, seed_role: role },
      });
      if (error) {
        if (error.message?.includes("already")) {
          // fetch existing
          const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
          // skip
        } else {
          console.error(`[${role} ${n}]`, error.message);
        }
        continue;
      }
      out[idx] = { id: data.user.id, email, fullName, phone };
      if ((idx+1) % 50 === 0) console.log(`  ${role}: ${idx+1}/${count}`);
    }
  }
  await Promise.all(Array.from({length: concurrency}, worker));
  return out.filter(Boolean);
}

console.log(`Creating ${NUM_LANDLORDS} landlords...`);
const landlords = await createBatch(NUM_LANDLORDS, "landlord", "landlord");
console.log(`Created ${landlords.length} landlords`);

console.log(`Creating ${NUM_TENANTS} tenants...`);
const tenants = await createBatch(NUM_TENANTS, "tenant", "tenant");
console.log(`Created ${tenants.length} tenants`);

// Set landlord roles (handle_new_user inserts 'tenant' by default)
console.log("Assigning landlord roles...");
const landlordIds = landlords.map(l => l.id);
for (let i = 0; i < landlordIds.length; i += 100) {
  const slice = landlordIds.slice(i, i+100);
  const rows = slice.map(id => ({ user_id: id, role: "landlord" }));
  const { error } = await sb.from("user_roles").upsert(rows, { onConflict: "user_id,role" });
  if (error) console.error("roles", error.message);
}

// Create properties + units for landlords
console.log("Creating properties & units...");
const allUnits = [];
for (let li = 0; li < landlords.length; li++) {
  const ll = landlords[li];
  const numProps = randInt(1, 3);
  const propRows = [];
  for (let p = 0; p < numProps; p++) {
    propRows.push({
      landlord_id: ll.id,
      name: `${rand(["Acacia","Baobab","Cedar","Daisy","Eden","Forest","Garden","Hibiscus","Ivory","Jacaranda"])} ${rand(["Court","Heights","Apartments","Residences","Plaza","Villas"])} ${li+1}-${p+1}`,
      address: `${randInt(1,200)} ${rand(["Moi","Kenyatta","Uhuru","Ngong","Thika","Mombasa"])} Road`,
      city: rand(cities),
      county: rand(cities),
      property_type: rand(propTypes),
    });
  }
  const { data: props, error: pErr } = await sb.from("properties").insert(propRows).select("id");
  if (pErr) { console.error("props", pErr.message); continue; }

  const unitRows = [];
  for (const prop of props) {
    const numUnits = randInt(2, 6);
    const usedLabels = new Set();
    let attempts = 0;
    while (usedLabels.size < numUnits && attempts < numUnits * 10) {
      attempts++;
      const label = `${rand(["A","B","C","D","E","F"])}${randInt(1, 24)}`;
      if (usedLabels.has(label)) continue;
      usedLabels.add(label);
      const rent = randInt(8, 60) * 1000;
      unitRows.push({
        property_id: prop.id,
        label,
        rent_amount: rent,
        deposit_amount: rent,
        bedrooms: randInt(1,4),
      });
    }
  }
  const { data: units, error: uErr } = await sb.from("units").insert(unitRows).select("id, rent_amount, property_id");
  if (uErr) { console.error("units", uErr.message); continue; }
  allUnits.push(...units.map(u => ({ ...u, landlord_id: ll.id })));
  if ((li+1) % 20 === 0) console.log(`  properties: ${li+1}/${landlords.length}`);
}
console.log(`Created ${allUnits.length} units`);

// Assign ~70% of tenants to a unit via lease
console.log("Creating leases...");
const shuffled = [...allUnits].sort(() => Math.random() - 0.5);
const leaseCount = Math.min(tenants.length, Math.floor(allUnits.length * 0.85));
const leaseRows = [];
const occupiedUnitIds = [];
for (let i = 0; i < leaseCount; i++) {
  const u = shuffled[i];
  const t = tenants[i];
  if (!u || !t) break;
  const startDaysAgo = randInt(10, 300);
  const start = new Date(Date.now() - startDaysAgo*86400000).toISOString().slice(0,10);
  leaseRows.push({
    unit_id: u.id, tenant_id: t.id, landlord_id: u.landlord_id,
    rent_amount: u.rent_amount, rent_due_day: randInt(1,28),
    deposit_amount: u.rent_amount, start_date: start, status: "active",
  });
  occupiedUnitIds.push(u.id);
}
for (let i = 0; i < leaseRows.length; i += 200) {
  const slice = leaseRows.slice(i, i+200);
  const { error } = await sb.from("leases").insert(slice);
  if (error) console.error("leases", error.message);
}
// Mark units occupied
for (let i = 0; i < occupiedUnitIds.length; i += 200) {
  const slice = occupiedUnitIds.slice(i, i+200);
  const { error } = await sb.from("units").update({ status: "occupied" }).in("id", slice);
  if (error) console.error("units occ", error.message);
}
console.log(`Created ${leaseRows.length} leases`);

// Summary
console.log("\n=== Seed summary ===");
const tables = ["properties", "units", "leases"];
const summary = {};
for (const t of tables) {
  const { count } = await sb.from(t).select("*", { count: "exact", head: true });
  summary[t] = count;
}
const { count: vacantCount } = await sb.from("units").select("*", { count: "exact", head: true }).eq("status", "vacant");
const { count: occupiedCount } = await sb.from("units").select("*", { count: "exact", head: true }).eq("status", "occupied");
const { count: activeLeases } = await sb.from("leases").select("*", { count: "exact", head: true }).eq("status", "active");
const { count: landlordRoles } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "landlord");
const { count: tenantRoles } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "tenant");

console.table({
  landlords: landlordRoles,
  tenants: tenantRoles,
  properties: summary.properties,
  units_total: summary.units,
  units_vacant: vacantCount,
  units_occupied: occupiedCount,
  leases_active: activeLeases,
});

console.log("Done.");
