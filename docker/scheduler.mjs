// Kör synken en gång per natt kl. 02 svensk tid genom att anropa appens /api/sync.
const HOUR = "02";
const fmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function stockholm(now) {
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: p.hour };
}

/** Ska synken köras nu? lastRunDate = datum (YYYY-MM-DD, svensk tid) för senaste körning. */
export function shouldRun(now, lastRunDate) {
  const { day, hour } = stockholm(now);
  return hour === HOUR && lastRunDate !== day;
}

async function main() {
  const url = process.env.SYNC_URL ?? "http://app:3000/api/sync";
  const token = process.env.SYNC_TOKEN;
  if (!token) throw new Error("SYNC_TOKEN saknas");
  let last = null;
  console.log(`Schemaläggare startad – synkar dagligen kl. ${HOUR} mot ${url}`);
  const tick = async () => {
    const now = new Date();
    if (!shouldRun(now, last)) return;
    last = stockholm(now).day;
    try {
      const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` } });
      console.log(`${new Date().toISOString()} synk ${res.status}: ${await res.text()}`);
    } catch (e) {
      console.error(`${new Date().toISOString()} synk misslyckades:`, e);
    }
  };
  setInterval(tick, 60_000);
  await tick();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
