import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Parameters
//   node scripts/seed-nairobi-market.mjs --landlords=1200 --tenants=3650 [--mode=target|add]
//   mode=target (default): tops up to the given TOTALS (counts what already exists)
//   mode=add:              creates exactly that many NEW landlords/tenants
//   --password=...  --corridor=Eastlands,Thika Road   (restrict estate weighting)
//   Legacy positional form still works: ... 1200 3650
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : dflt;
};
const positional = argv.filter((a) => !a.startsWith("--"));

const PASSWORD = flag("password", "Makao360#Demo2026!");
const MODE = flag("mode", "target");
const WANT_LANDLORDS = Number(flag("landlords", positional[0] ?? 1200));
const WANT_TENANTS = Number(flag("tenants", positional[1] ?? 3650));
const CORRIDOR_FILTER = (flag("corridor", "") || "")
  .split(",").map((c) => c.trim()).filter(Boolean);

// estate: [name, corridor, rentalUnits(weight), avgRent, lat, lng]
const ESTATES = [
  ["Pipeline","Eastlands",45000,9000,-1.3218,36.8983],
  ["Tassia","Eastlands",40000,12000,-1.3186,36.8880],
  ["Kayole","Eastlands",38000,7000,-1.2740,36.9200],
  ["Umoja","Eastlands",34000,9000,-1.2810,36.8930],
  ["Donholm","Eastlands",32000,14000,-1.2930,36.8880],
  ["Embakasi","Eastlands",30000,11000,-1.3060,36.9130],
  ["Komarock","Eastlands",28000,10000,-1.2680,36.9280],
  ["Fedha","Eastlands",25000,18000,-1.3110,36.8890],
  ["Ruai","Kangundo Road",22000,7000,-1.2680,36.9930],
  ["Dandora","Eastlands",22000,6500,-1.2500,36.8960],
  ["Kariobangi South","Eastlands",20000,7500,-1.2600,36.8830],
  ["Kariobangi North","Eastlands",18000,7000,-1.2530,36.8800],
  ["Huruma","Eastlands",18000,6500,-1.2620,36.8720],
  ["South B","Mombasa Road",18000,22000,-1.3110,36.8360],
  ["Mukuru","Eastlands",17000,5000,-1.3080,36.8720],
  ["Buruburu","Eastlands",14000,16000,-1.2830,36.8790],
  ["Tena","Eastlands",12000,13000,-1.2900,36.8850],
  ["Saika","Kangundo Road",11000,8000,-1.2620,36.9520],
  ["Njiru","Kangundo Road",11000,7000,-1.2600,36.9450],
  ["Nyayo Estate","Mombasa Road",13000,25000,-1.3200,36.8760],
  ["Jacaranda","Eastlands",10000,12000,-1.2760,36.9100],
  ["Harambee","Eastlands",10000,9000,-1.2960,36.8770],
  ["Mowlem","Eastlands",10000,8000,-1.2720,36.9060],
  ["Umoja Innercore","Eastlands",12000,8500,-1.2790,36.8970],
  ["California","Eastlands",10000,7000,-1.2850,36.8600],
  ["Eastleigh North","Eastlands",14000,12000,-1.2740,36.8480],
  ["Eastleigh South","Eastlands",13000,11000,-1.2790,36.8460],
  ["Imara Daima","Mombasa Road",18000,16000,-1.3310,36.8790],
  ["South C","Mombasa Road",15000,26000,-1.3180,36.8300],
  ["Syokimau","Mombasa Road",15000,22000,-1.3630,36.9420],
  ["Mlolongo","Mombasa Road",20000,10000,-1.3860,36.9520],
  ["Athi River","Mombasa Road",18000,9000,-1.4560,36.9780],
  ["Sabaki","Mombasa Road",12000,9000,-1.4310,36.9700],
  ["Greenfields","Mombasa Road",12000,15000,-1.3350,36.8850],
  ["Greatwall","Mombasa Road",8000,17000,-1.3560,36.9060],
  ["Gateway","Mombasa Road",6000,16000,-1.3620,36.9100],
  ["Katani","Mombasa Road",8000,11000,-1.3900,36.9600],
  ["JKIA View","Mombasa Road",5000,14000,-1.3400,36.9200],
  ["Roysambu","Thika Road",18000,14000,-1.2180,36.8890],
  ["Zimmerman","Thika Road",16000,11000,-1.2130,36.8930],
  ["Kahawa West","Thika Road",15000,12000,-1.1960,36.9070],
  ["Kahawa Sukari","Thika Road",8000,20000,-1.1830,36.9280],
  ["Mirema","Thika Road",12000,18000,-1.2070,36.8990],
  ["Githurai 44","Thika Road",15000,9000,-1.1980,36.9200],
  ["Githurai 45","Thika Road",18000,9000,-1.1900,36.9260],
  ["Kahawa Wendani","Thika Road",10000,12000,-1.1880,36.9200],
  ["TRM Area","Thika Road",9000,17000,-1.2200,36.8870],
  ["Garden Estate","Kiambu Road",6000,28000,-1.2320,36.8700],
  ["Ruiru","Thika Road",30000,11000,-1.1450,36.9600],
  ["Membley","Thika Road",8000,25000,-1.1560,36.9400],
  ["Kamakis","Thika Road",10000,15000,-1.1720,36.9700],
  ["Juja","Thika Road",20000,8000,-1.1020,37.0130],
  ["Karen Plains","Ngong Road",5000,45000,-1.3320,36.7100],
  ["Racecourse","Ngong Road",7000,18000,-1.3080,36.7620],
  ["Adams","Ngong Road",6000,20000,-1.3030,36.7770],
  ["Dagoretti Corner","Ngong Road",9000,13000,-1.2980,36.7460],
  ["Kawangware","Ngong Road",16000,7000,-1.2860,36.7420],
  ["Satellite","Ngong Road",9000,8000,-1.2890,36.7330],
  ["Ngong Town","Ngong Road",12000,9000,-1.3540,36.6560],
  ["Rongai","Ngong Road",18000,10000,-1.3960,36.7480],
  ["Olekasasi","Ngong Road",7000,9000,-1.3800,36.7300],
  ["Kandisi","Ngong Road",6000,8000,-1.4060,36.7550],
  ["Nkoroi","Ngong Road",6000,11000,-1.3860,36.7360],
  ["Mihang'o","Kangundo Road",9000,9000,-1.2880,36.9700],
  ["Joska","Kangundo Road",8000,6000,-1.2400,37.0500],
  ["Malaa","Kangundo Road",7000,6000,-1.2300,37.0900],
  ["Kamulu","Kangundo Road",9000,6500,-1.2500,37.0200],
  ["Chokaa","Kangundo Road",7000,7000,-1.2620,36.9600],
  ["Mwiki","Kangundo Road",12000,7500,-1.2200,36.9300],
  ["Sunton","Kangundo Road",9000,8000,-1.2160,36.9130],
  ["Kwa Njenga","Eastlands",10000,5500,-1.3200,36.8760],
  ["Matopeni","Kangundo Road",6000,7000,-1.2700,36.9350],
  ["Mountain View","Waiyaki Way",6000,20000,-1.2620,36.7440],
  ["Uthiru","Waiyaki Way",10000,10000,-1.2680,36.7100],
  ["Kinoo","Waiyaki Way",12000,11000,-1.2620,36.6900],
  ["Regen","Waiyaki Way",7000,12000,-1.2700,36.7200],
  ["Kangemi","Waiyaki Way",14000,7000,-1.2660,36.7460],
  ["Kabete","Waiyaki Way",8000,13000,-1.2450,36.7150],
  ["Lower Kabete","Waiyaki Way",6000,22000,-1.2360,36.7480],
  ["Gitaru","Waiyaki Way",9000,9000,-1.2450,36.6700],
  ["Madaraka","Lang'ata",7000,24000,-1.3100,36.8180],
  ["Nairobi West","Lang'ata",9000,22000,-1.3160,36.8130],
  ["Lang'ata","Lang'ata",12000,20000,-1.3390,36.7530],
  ["Nyayo Highrise","Lang'ata",9000,15000,-1.3070,36.8000],
  ["Mugumoini","Lang'ata",7000,12000,-1.3300,36.7900],
  ["Jamhuri","Lang'ata",6000,17000,-1.3000,36.7880],
  ["Mbagathi","Lang'ata",7000,13000,-1.3080,36.7830],
  ["Southlands","Lang'ata",6000,16000,-1.3250,36.7800],
  ["Uhuru Gardens","Lang'ata",5000,18000,-1.3210,36.7860],
  ["Ridgeways","Kiambu Road",4000,45000,-1.2200,36.8420],
  ["Fourways","Kiambu Road",5000,26000,-1.1900,36.8380],
  ["Edenville","Kiambu Road",4000,30000,-1.1800,36.8300],
  ["Thindigua","Kiambu Road",9000,20000,-1.1930,36.8380],
  ["Ciata","Kiambu Road",4000,28000,-1.2050,36.8460],
  ["Kihara","Kiambu Road",7000,14000,-1.2100,36.7800],
  ["Kiambu Town","Kiambu Road",12000,12000,-1.1710,36.8350],
  ["Banana","Kiambu Road",7000,13000,-1.1600,36.7600],
];

const ACTIVE_ESTATES = CORRIDOR_FILTER.length
  ? ESTATES.filter((e) => CORRIDOR_FILTER.includes(e[1]))
  : ESTATES;
if (!ACTIVE_ESTATES.length) {
  console.error("No estates match --corridor=", CORRIDOR_FILTER.join(","));
  process.exit(1);
}
const TOTAL_WEIGHT = ACTIVE_ESTATES.reduce((s, e) => s + e[2], 0);
const CUM = [];
{
  let acc = 0;
  for (const e of ACTIVE_ESTATES) { acc += e[2]; CUM.push([acc / TOTAL_WEIGHT, e]); }
}
const pickEstate = () => { const r = Math.random(); return (CUM.find(([c]) => r <= c) ?? CUM[CUM.length - 1])[1]; };

const FIRST = ["Amani","Baraka","Chebet","Daudi","Esther","Faraja","Gathoni","Hawa","Imani","Juma","Kamau","Lulu","Mumbi","Neema","Otieno","Pendo","Rehema","Salma","Tatu","Wambui","Yusuf","Zawadi","Achieng","Bahati","Fatuma","Halima","Kioko","Mwangi","Onyango","Sifa","Upendo","Waweru","Zuri","Brian","Cynthia","David","Grace","Hassan","Irene","James","Kevin","Lydia","Michael","Naomi","Patricia","Ruth","Samuel","Teresa","Violet","Winnie"];
const LAST = ["Kariuki","Mwangi","Otieno","Wanjiku","Kamau","Ochieng","Hassan","Njoroge","Achieng","Kimani","Mutua","Wafula","Maina","Ouma","Kilonzo","Cheruiyot","Korir","Owino","Kibet","Wekesa","Akinyi","Barasa","Mburu","Karanja","Musyoka","Nderitu","Abdi","Gathoni","Njeri","Omondi"];
const BLOCK = ["Court","Heights","Apartments","Residences","Plaza","Villas","Gardens","Towers","Mews","Homes","Estate","Suites"];
const PTYPE = ["apartment","bedsitter","studio","maisonette","bungalow","mixed_use"];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pad = (n, w) => String(n).padStart(w, "0");
const jitter = (v) => v + (Math.random() - 0.5) * 0.02;

// landlord size segments (small / medium / large)
function landlordUnitTarget() {
  const r = Math.random();
  if (r < 0.72) return randInt(1, 8);        // small: 1-8 units
  if (r < 0.93) return randInt(9, 40);       // medium
  if (r < 0.99) return randInt(41, 100);     // large
  return randInt(101, 150);                  // institutional
}

async function createUsers(count, prefix, startIdx) {
  const out = [];
  let i = 0, made = 0;
  const worker = async () => {
    for (;;) {
      const idx = i++;
      if (idx >= count) return;
      const n = startIdx + idx;
      const fullName = `${rand(FIRST)} ${rand(LAST)}`;
      const phone = `2547${pad(randInt(0, 99999999), 8)}`;
      const email = `${prefix}${pad(n, 5)}@makao360.demo`;
      const { data, error } = await sb.auth.admin.createUser({
        email, password: PASSWORD, email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      if (error) { if (!error.message?.includes("already")) console.error(prefix, n, error.message); continue; }
      out[idx] = { id: data.user.id, fullName, phone, email };
      if (++made % 250 === 0) console.log(`  ${prefix}: ${made}/${count}`);
    }
  };
  await Promise.all(Array.from({ length: 25 }, worker));
  return out.filter(Boolean);
}

async function roleCount(role) {
  const { count } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", role);
  return count ?? 0;
}

const existingLandlords = await roleCount("landlord");
const existingTenants = await roleCount("tenant");
const TARGET_NEW_LANDLORDS =
  MODE === "add" ? WANT_LANDLORDS : Math.max(0, WANT_LANDLORDS - existingLandlords);
const TARGET_NEW_TENANTS =
  MODE === "add" ? WANT_TENANTS : Math.max(0, WANT_TENANTS - existingTenants);

console.table({
  mode: MODE,
  target_landlords: WANT_LANDLORDS,
  existing_landlords: existingLandlords,
  new_landlords: TARGET_NEW_LANDLORDS,
  target_tenants: WANT_TENANTS,
  existing_tenants: existingTenants,
  new_tenants: TARGET_NEW_TENANTS,
  corridors: CORRIDOR_FILTER.join(",") || "all",
});

console.log(`Creating ${TARGET_NEW_LANDLORDS} landlords...`);
const landlords = TARGET_NEW_LANDLORDS
  ? await createUsers(TARGET_NEW_LANDLORDS, "ll", Date.now() % 100000)
  : [];
console.log(`landlords created: ${landlords.length}`);

for (let i = 0; i < landlords.length; i += 200) {
  const rows = landlords.slice(i, i + 200).map((l) => ({ user_id: l.id, role: "landlord" }));
  const { error } = await sb.from("user_roles").upsert(rows, { onConflict: "user_id,role" });
  if (error) console.error("roles", error.message);
}

console.log("Creating properties & units...");
const allUnits = [];
let propCount = 0;
for (let li = 0; li < landlords.length; li++) {
  const ll = landlords[li];
  let remaining = landlordUnitTarget();
  const numProps = remaining > 100 ? randInt(3, 6) : remaining > 40 ? randInt(2, 4) : remaining > 8 ? randInt(1, 2) : 1;
  const propRows = [];
  const estates = [];
  for (let p = 0; p < numProps; p++) {
    const e = pickEstate();
    estates.push(e);
    propRows.push({
      landlord_id: ll.id,
      name: `${rand(FIRST)} ${rand(BLOCK)} — ${e[0]}`,
      address: `${randInt(1, 300)} ${e[0]} Road`,
      city: "Nairobi",
      county: e[1],
      property_type: rand(PTYPE),
      latitude: jitter(e[4]),
      longitude: jitter(e[5]),
      notes: `${e[1]} corridor`,
    });
  }
  const { data: props, error: pErr } = await sb.from("properties").insert(propRows).select("id");
  if (pErr) { console.error("props", pErr.message); continue; }
  propCount += props.length;

  const unitRows = [];
  props.forEach((prop, pi) => {
    const e = estates[pi];
    const share = pi === props.length - 1 ? remaining : Math.max(1, Math.round(remaining / (props.length - pi)));
    remaining -= share;
    for (let n = 0; n < Math.max(share, 1); n++) {
      const rent = Math.round((e[3] * (0.75 + Math.random() * 0.6)) / 500) * 500;
      unitRows.push({
        property_id: prop.id,
        label: `${String.fromCharCode(65 + Math.floor(n / 20))}${pad((n % 20) + 1, 2)}`,
        rent_amount: rent,
        deposit_amount: rent,
        bedrooms: randInt(1, 4),
      });
    }
  });
  for (let k = 0; k < unitRows.length; k += 300) {
    const { data: units, error: uErr } = await sb.from("units").insert(unitRows.slice(k, k + 300)).select("id, rent_amount");
    if (uErr) { console.error("units", uErr.message); continue; }
    allUnits.push(...units.map((u) => ({ ...u, landlord_id: ll.id })));
  }
  if ((li + 1) % 100 === 0) console.log(`  landlord props: ${li + 1}/${landlords.length}, units so far ${allUnits.length}`);
}
console.log(`properties: ${propCount}, units: ${allUnits.length}`);

console.log(`Creating ${TARGET_NEW_TENANTS} tenants...`);
const tenants = TARGET_NEW_TENANTS
  ? await createUsers(TARGET_NEW_TENANTS, "tn", Date.now() % 100000)
  : [];
console.log(`tenants created: ${tenants.length}`);

// also pull vacant pre-existing units so occupancy spreads
const { data: legacyVacant } = await sb.from("units").select("id, rent_amount").eq("status", "vacant").limit(4000);
const pool = [...allUnits, ...(legacyVacant ?? [])].sort(() => Math.random() - 0.5);

const leaseRows = [];
const occupied = [];
for (let i = 0; i < tenants.length && i < pool.length; i++) {
  const u = pool[i], t = tenants[i];
  const start = new Date(Date.now() - randInt(15, 400) * 86400000).toISOString().slice(0, 10);
  leaseRows.push({
    unit_id: u.id, tenant_id: t.id, landlord_id: u.landlord_id ?? undefined,
    rent_amount: u.rent_amount, deposit_amount: u.rent_amount,
    rent_due_day: randInt(1, 10), start_date: start, status: "active",
  });
  occupied.push(u.id);
}
// legacy units lack landlord_id in pool -> resolve
const needLandlord = leaseRows.filter((r) => !r.landlord_id);
if (needLandlord.length) {
  const ids = needLandlord.map((r) => r.unit_id);
  const map = new Map();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb.from("units").select("id, properties(landlord_id)").in("id", ids.slice(i, i + 500));
    (data ?? []).forEach((u) => map.set(u.id, u.properties?.landlord_id));
  }
  for (const r of needLandlord) r.landlord_id = map.get(r.unit_id);
}
const validLeases = leaseRows.filter((r) => r.landlord_id);
for (let i = 0; i < validLeases.length; i += 200) {
  const { error } = await sb.from("leases").insert(validLeases.slice(i, i + 200));
  if (error) console.error("leases", error.message);
}
for (let i = 0; i < occupied.length; i += 300) {
  await sb.from("units").update({ status: "occupied" }).in("id", occupied.slice(i, i + 300));
}
console.log(`leases: ${validLeases.length}`);

const counts = {};
for (const t of ["properties", "units", "leases"]) {
  const { count } = await sb.from(t).select("*", { count: "exact", head: true });
  counts[t] = count;
}
const { count: llRoles } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "landlord");
const { count: tnRoles } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "tenant");
const { count: vacant } = await sb.from("units").select("*", { count: "exact", head: true }).eq("status", "vacant");
console.table({ landlords: llRoles, tenants: tnRoles, ...counts, vacant_units: vacant });
console.log("Done.");
