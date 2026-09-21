export function dayKey(ms = Date.now()) {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

export function msUntilMidnight() {
  const n = new Date();
  const next = new Date(n);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - n.getTime();
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(a: number) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function watchersNow(key: string) {
  const n = Date.now();
  const hour = new Date(n).getHours();
  const slice = Math.floor(n / 14000);
  const h = hashStr(`${key}:${hour}:${slice}`);
  const nightBoost = hour >= 21 || hour < 6 ? 2100 : hour >= 18 ? 1100 : 240;
  return 380 + (h % 2800) + nightBoost + hour * 19 + (slice % 17);
}

export function weekKeys(today = dayKey()) {
  const d = new Date(`${today}T12:00:00`);
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    keys.push(dayKey(x.getTime()));
  }
  return keys;
}
