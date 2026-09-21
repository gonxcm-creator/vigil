import { hashStr } from "./seed";

const PEPPER = "vigil.keep.v8.cala";

export const SEAL_KEYS = [
  "lang",
  "nightIndex",
  "oil",
  "timber",
  "iron",
  "flares",
  "wicks",
  "repairs",
  "integrity",
  "guests",
  "relics",
  "journal",
  "bestiary",
  "villageLights",
  "dailyClaimedDate",
  "dailyTides",
  "tutorialBeat",
  "tutorialDone",
  "warnSeen",
  "reducedMotion",
  "muted",
  "captions",
  "contrast",
  "bigType",
  "aimAssist",
  "difficulty",
  "sfxVol",
  "shake",
  "fpsCap",
  "humansBurned",
  "visitorsAdmitted",
  "emptyDawnStreak",
  "ending",
  "nightsPlayed",
  "aceiteraUsed",
  "ghostReady",
  "climate",
  "pendingKill",
] as const;

export function sign(s: Record<string, unknown>): string {
  const body = SEAL_KEYS.map((k) => `${k}:${JSON.stringify(s[k])}`).join("|");
  return hashStr(`${PEPPER}|${body}`).toString(16);
}

export function intact(raw: unknown, s: Record<string, unknown>): boolean {
  if (!raw || typeof raw !== "object") return false;
  const rec = raw as { seal?: unknown; integrity?: unknown };
  const token = typeof rec.seal === "string" ? rec.seal : typeof rec.integrity === "string" ? rec.integrity : "";
  return token.length > 0 && token === sign(s);
}

export function pickSealed(s: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of SEAL_KEYS) out[k] = s[k];
  return out;
}
