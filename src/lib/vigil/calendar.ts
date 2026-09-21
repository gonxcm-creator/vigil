import { hashStr, mulberry32 } from "./seed";
import type { ClimateId, SignalId } from "./types";

const SIGNALS: SignalId[] = ["noBreath", "water", "hands", "seeksBeam", "silent", "echo"];

export type TidePhase = "arriving" | "open" | "claimed" | "passed";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function shiftCivil(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function localClock(ms = Date.now()) {
  const d = new Date(ms);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) bag[p.type] = p.value;
  return {
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    date: `${bag.year}-${bag.month}-${bag.day}`,
  };
}

export function civilDate(ms = Date.now()) {
  return localClock(ms).date;
}

export function dailySeedNum(ms = Date.now()) {
  return hashStr(`${civilDate(ms)}vigil-cala`);
}

export function tideWindow(ms = Date.now(), claimedDate = "") {
  const { hour, minute, date } = localClock(ms);
  const open = hour >= 18 || hour < 8;
  const claimed = claimedDate === date || (hour < 8 && claimedDate === shiftCivil(date, -1));
  const yest = shiftCivil(date, -1);
  const missedLast =
    !open && claimedDate !== "" && claimedDate !== date && claimedDate !== yest;
  const phase: TidePhase = open ? (claimed ? "claimed" : "open") : "arriving";
  const targetH = open ? 8 : 18;
  const curM = hour * 60 + minute;
  let tgtM = targetH * 60;
  if (tgtM <= curM) tgtM += 24 * 60;
  const until = (tgtM - curM) * 60 * 1000;
  const untilLabel = open ? "08:00" : "18:00";
  return { open, until, hour, phase, claimed, date, untilLabel, missed: missedLast };
}

export function fmtRemain(ms: number, untilLabel = "") {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const clock = h > 0 ? `${h} h ${String(m).padStart(2, "0")} m` : `${m} m`;
  return untilLabel ? `${clock} · ${untilLabel}` : clock;
}

export function todaySignals(nightIndex: number, ms = Date.now()): SignalId[] {
  const rng = mulberry32(dailySeedNum(ms) ^ (Math.floor(nightIndex / 2) * 9973));
  const bag = [...SIGNALS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = bag[i];
    bag[i] = bag[j];
    bag[j] = t;
  }
  return bag.slice(0, 3);
}

export function todayClimate(ms = Date.now()): ClimateId {
  const r = mulberry32(dailySeedNum(ms) ^ 17)();
  if (r < 0.34) return "fog";
  if (r < 0.62) return "storm";
  return "calm";
}

export function packCode(n: number) {
  return (n >>> 0).toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "A").slice(0, 4).padStart(4, "A");
}

export function unpackCode(code: string) {
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  if (c.length < 3) return 0;
  const n = parseInt(c, 36);
  return Number.isFinite(n) ? n >>> 0 : 0;
}

export function packSea(slots: { kind: string; side: string }[], seed: number) {
  const head = packCode(seed);
  let payload = "";
  try {
    payload = btoa(JSON.stringify(slots)).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  } catch {
    payload = "A";
  }
  return `VIGIL-MAR-${head}-${payload}`;
}

export function unpackSea(raw: string): { seed: number; slots: { kind: string; side: string }[] } | null {
  const t = raw.trim();
  const m = t.match(/VIGIL-MAR-([A-Z0-9]{3,4})-([A-Za-z0-9_-]+)/i);
  if (m) {
    const seed = unpackCode(m[1]);
    try {
      const json = atob(m[2].replace(/-/g, "+").replace(/_/g, "/"));
      const slots = JSON.parse(json) as { kind: string; side: string }[];
      if (Array.isArray(slots) && slots.length) return { seed, slots };
    } catch {
      return { seed, slots: [] };
    }
    return { seed, slots: [] };
  }
  const n = unpackCode(t);
  return n ? { seed: n, slots: [] } : null;
}
