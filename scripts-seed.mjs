import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const PASSWORD = "Demo!2026";
const FIRST = ["Amina","Brian","Cynthia","David","Esther","Felix","Grace","Hassan","Irene","James","Kevin","Lydia","Michael","Naomi","Otieno","Patricia","Quincy","Ruth","Samuel","Teresa","Umar","Violet","Wanjiru","Xavier","Yvonne","Zachary","Anne","Boniface","Caroline","Dennis","Eunice","Francis","Gladys","Henry","Ivy","Joseph","Kelvin","Linda","Martin","Njeri","Oscar","Peter","Queenie","Rose","Stephen","Tabitha","Uhuru","Victor","Winnie","Yusuf"];
const LAST = ["Achieng","Barasa","Chebet","Mwangi","Otieno","Kamau","Kariuki","Mutua","Wambui","Njoroge","Kiprono","Cheruiyot","Omondi","Onyango","Wafula","Wanjala","Maina","Karanja","Hassan","Abdi","Korir","Ngigi","Mburu","Gathoni","Nderitu","Ouma","Atieno","Musyoka","Kimani","Munyao"];
const PROP_NAMES = ["Acacia Court","Baobab Heights","Cedar Towers","Dune Apartments","Eden Estate","Fig Tree","Garden View","Hillside Park","Indigo Suites","Jasmine Court","Kifaru Towers","Limuru Heights","Magnolia Mews","Nile Heights","Oasis Park","Palm Grove","Quartz Court","Rose Gardens","Savanna Suites","Tamarind","Uhuru Heights","Victoria Court","Westlands Park","Zen Apartments"];
const TYPES = ["apartment","bungalow","maisonette","studio","commercial"];
const CITIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Ruiru","Kiambu","Machakos","Naivasha"];

function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
function phone(){ return "2547" + String(randInt(10000000, 99999999)); }

async function sql(query, params=[]) {
  // use service key to call PostgREST? Easier: direct fetch to /rest/v1/rpc isn't generic. We'll use auth admin then table inserts via supabase-js.
}

const stats = { landlords:0, properties:0, units:0, tenants:0, leases:0, cycles:0, contributions:0, payouts:0, errors:[] };

async function createUser(email, fullName, ph, role) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { full_name: fullName, phone: ph }
  });
  if (error) {
    if (error.message.includes("already")) {
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1, email });
      if (list?.users?.[0]) return list.users[0];
    }
    throw error;
  }
  // handle_new_user trigger creates profile + tenant role automatically.
  // ensure phone is set on profile (trigger reads from raw_user_meta_data)
  await sb.from("profiles").update({ phone: ph, full_name: fullName }).eq("user_id", data.user.id);
  if (role && role !== "tenant") {
    await sb.from("user_roles").insert({ user_id: data.user.id, role });
  }
  return data.user;
}

const today = new Date();
const iso = (d) => d.toISOString().slice(0,10);

async function seedLandlord(i) {
  const fn = `${rand(FIRST)} ${rand(LAST)}`;
  const email = `landlord${i}@makao360.app`;
  const ph = phone();
  const u = await createUser(email, fn, ph, "landlord");
  stats.landlords++;

  const propCount = randInt(1, 4);
  for (let p=0; p<propCount; p++) {
    const { data: prop, error } = await sb.from("properties").insert({
      landlord_id: u.id,
      name: `${rand(PROP_NAMES)} ${randInt(1,99)}`,
      address: `${randInt(1,500)} ${rand(["Ngong","Mombasa","Lang'ata","Thika","Waiyaki","Argwings"])} Rd`,
      city: rand(CITIES), county: rand(CITIES),
      property_type: rand(TYPES),
    }).select().single();
    if (error) { stats.errors.push(error.message); continue; }
    stats.properties++;

    const unitCount = randInt(2, 8);
    const units = [];
    for (let n=0; n<unitCount; n++) {
      units.push({
        property_id: prop.id,
        label: `${String.fromCharCode(65 + Math.floor(n/4))}${(n%4)+1}`,
        rent_amount: randInt(8, 60) * 1000,
        deposit_amount: randInt(8, 60) * 1000,
        bedrooms: randInt(1, 4),
        status: "vacant",
      });
    }
    const { data: createdUnits, error: uerr } = await sb.from("units").insert(units).select();
    if (uerr) { stats.errors.push(uerr.message); continue; }
    stats.units += createdUnits.length;

    // Occupy 50-80% of units with tenants
    const occupyCount = Math.floor(createdUnits.length * (0.5 + Math.random()*0.3));
    for (let t=0; t<occupyCount; t++) {
      const unit = createdUnits[t];
      const tfn = `${rand(FIRST)} ${rand(LAST)}`;
      const tph = phone();
      const temail = `tenant_${u.id.slice(0,4)}_${unit.id.slice(0,4)}@makao360.app`;
      let tu;
      try { tu = await createUser(temail, tfn, tph, "tenant"); stats.tenants++; }
      catch(e) { stats.errors.push(`tenant: ${e.message}`); continue; }

      const startMonthsAgo = randInt(1, 10);
      const startDate = new Date(today.getFullYear(), today.getMonth() - startMonthsAgo, 1);
      const dueDay = randInt(1, 10);

      const { data: lease, error: lerr } = await sb.from("leases").insert({
        unit_id: unit.id, tenant_id: tu.id, landlord_id: u.id,
        rent_amount: unit.rent_amount, rent_due_day: dueDay,
        deposit_amount: unit.deposit_amount, start_date: iso(startDate),
        status: "active",
      }).select().single();
      if (lerr) { stats.errors.push(lerr.message); continue; }
      stats.leases++;
      await sb.from("units").update({ status: "occupied" }).eq("id", unit.id);

      // create cycles for each month from start to current
      for (let m = startMonthsAgo; m >= 0; m--) {
        const ps = new Date(today.getFullYear(), today.getMonth() - m, 1);
        const pe = new Date(today.getFullYear(), today.getMonth() - m + 1, 0);
        const dd = new Date(today.getFullYear(), today.getMonth() - m, dueDay);
        const { data: cyc, error: cerr } = await sb.from("rent_cycles").insert({
          lease_id: lease.id, period_start: iso(ps), period_end: iso(pe),
          due_date: iso(dd), target_amount: unit.rent_amount, status: "open",
        }).select().single();
        if (cerr) { stats.errors.push(cerr.message); continue; }
        stats.cycles++;

        // Past cycles: 70% fully paid, 20% partial, 10% unpaid.
        // Current cycle (m===0): random partial.
        const isCurrent = m === 0;
        const r = Math.random();
        let paid = 0;
        if (isCurrent) paid = Math.random() < 0.5 ? Math.floor(unit.rent_amount * Math.random()) : 0;
        else if (r < 0.7) paid = unit.rent_amount;
        else if (r < 0.9) paid = Math.floor(unit.rent_amount * (0.3 + Math.random()*0.5));

        if (paid > 0) {
          // 1-3 contributions
          const n = randInt(1, 3);
          let remaining = paid;
          for (let k=0; k<n; k++) {
            const amt = k === n-1 ? remaining : Math.floor(remaining / (n-k) * (0.7 + Math.random()*0.6));
            const a = Math.max(100, Math.min(remaining, amt));
            remaining -= a;
            const when = new Date(ps.getTime() + Math.random() * (Math.min(today.getTime(), pe.getTime()) - ps.getTime()));
            await sb.from("contributions").insert({
              tenant_id: tu.id, lease_id: lease.id, cycle_id: cyc.id,
              amount: a, source: "mpesa_stk", status: "success",
              payer_phone: tph, mpesa_receipt: "MPESA-" + Math.random().toString(36).slice(2,12).toUpperCase(),
              contributed_at: when.toISOString(),
            });
            stats.contributions++;
            if (remaining <= 0) break;
          }
        }
      }

      // occasional payout for past completed cycles
      if (Math.random() < 0.6) {
        const { data: completed } = await sb.from("rent_cycles")
          .select("id, accumulated_amount, target_amount")
          .eq("lease_id", lease.id);
        const fullCycles = (completed ?? []).filter(c => c.accumulated_amount >= c.target_amount && c.target_amount > 0);
        for (const c of fullCycles.slice(0, 2)) {
          await sb.from("payouts").insert({
            lease_id: lease.id, landlord_id: u.id, cycle_id: c.id,
            amount: c.target_amount, status: "paid",
            mpesa_receipt: "PAYOUT-" + Math.random().toString(36).slice(2,12).toUpperCase(),
            paid_at: new Date().toISOString(),
          });
          stats.payouts++;
        }
      }
    }
  }
}

const start = Date.now();
const N = parseInt(process.argv[2] ?? "100", 10);
const OFFSET = parseInt(process.argv[3] ?? "1", 10);

for (let i = OFFSET; i < OFFSET + N; i++) {
  try { await seedLandlord(i); }
  catch (e) { stats.errors.push(`landlord ${i}: ${e.message}`); }
  if (i % 5 === 0) console.log(`[${i}] ${JSON.stringify(stats)} (${Math.round((Date.now()-start)/1000)}s)`);
}
console.log("DONE", JSON.stringify(stats, null, 2));
console.log("Errors sample:", stats.errors.slice(0, 5));
