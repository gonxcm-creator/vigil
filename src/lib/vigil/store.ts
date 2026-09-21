import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { civilDate } from "./calendar";
import { intact, pickSealed, sign } from "./seal";
import { clamp, safeStorage } from "./safe";
import { RELIC_IDS } from "./relics";
import { KIT, type ClimateId, type Diff, type EndingId, type Guest, type JournalPage, type RelicId } from "./types";

export type { Diff };

export interface VigilSave {
  lang: "es" | "en";
  nightIndex: number;
  oil: number;
  timber: number;
  iron: number;
  flares: number;
  wicks: number;
  repairs: number;
  integrity: number;
  guests: Guest[];
  relics: RelicId[];
  journal: JournalPage[];
  bestiary: string;
  villageLights: number;
  dailyClaimedDate: string;
  dailyTides: number;
  tutorialBeat: number;
  tutorialDone: boolean;
  warnSeen: boolean;
  reducedMotion: boolean;
  muted: boolean;
  captions: boolean;
  contrast: boolean;
  bigType: boolean;
  aimAssist: boolean;
  difficulty: Diff;
  sfxVol: number;
  shake: boolean;
  fpsCap: boolean;
  humansBurned: number;
  visitorsAdmitted: number;
  emptyDawnStreak: number;
  ending: EndingId | null;
  nightsPlayed: number;
  aceiteraUsed: boolean;
  ghostReady: boolean;
  climate: ClimateId;
  pendingKill: boolean;
}

interface VigilState extends VigilSave {
  setLang: (lang: "es" | "en") => void;
  setMuted: (v: boolean) => void;
  setMotion: (v: boolean) => void;
  setFlag: (k: "captions" | "contrast" | "bigType" | "aimAssist" | "warnSeen" | "fpsCap", v: boolean) => void;
  setDiff: (d: Diff) => void;
  setVol: (n: number) => void;
  setShake: (v: boolean) => void;
  importSnap: (raw: unknown) => boolean;
  grantKit: () => void;
  finishTutorial: (beat?: number) => void;
  addCargo: (c: { oil?: number; timber?: number; iron?: number }) => void;
  spend: (c: { oil?: number; timber?: number; iron?: number; flares?: number }) => boolean;
  spendFlare: () => boolean;
  craftFlare: () => boolean;
  craftWick: () => boolean;
  craftRepair: () => boolean;
  setGuests: (g: Guest[]) => void;
  addRelic: (id: RelicId) => void;
  addJournal: (p: JournalPage) => void;
  unlockBeast: (id: string) => void;
  setClimate: (c: ClimateId) => void;
  applyDawn: (p: {
    oilSpent: number;
    cargo: { oil: number; timber: number; iron: number };
    guests: Guest[];
    humansBurned: number;
    visitorsAdmitted: number;
    humansNet: number;
    daily: boolean;
  }) => EndingId | null;
  setEnding: (e: EndingId) => void;
  markTide: (date: string) => void;
}

function asDiff(v: unknown): Diff {
  return v === "easy" || v === "hard" ? v : "norm";
}

function asRelics(raw: unknown): RelicId[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is RelicId => typeof id === "string" && RELIC_IDS.includes(id as RelicId)).slice(0, 3);
}

function asGuests(raw: unknown): Guest[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((g) => g && typeof g === "object" && typeof (g as Guest).id === "string").slice(0, 6) as Guest[];
}

function asJournal(raw: unknown): JournalPage[] {
  if (Array.isArray(raw)) {
    return raw.filter((p) => p && typeof p === "object").slice(0, 80) as JournalPage[];
  }
  return [];
}

export const empty = (): VigilSave => ({
  lang: "es",
  nightIndex: 1,
  oil: KIT.oil,
  timber: KIT.timber,
  iron: KIT.iron,
  flares: KIT.flares,
  wicks: KIT.wicks,
  repairs: KIT.repairs,
  integrity: KIT.integrity,
  guests: [],
  relics: [],
  journal: [],
  bestiary: "",
  villageLights: 0,
  dailyClaimedDate: "",
  dailyTides: 0,
  tutorialBeat: 0,
  tutorialDone: false,
  warnSeen: false,
  reducedMotion: false,
  muted: false,
  captions: false,
  contrast: false,
  bigType: false,
  aimAssist: false,
  difficulty: "norm",
  sfxVol: 80,
  shake: true,
  fpsCap: false,
  humansBurned: 0,
  visitorsAdmitted: 0,
  emptyDawnStreak: 0,
  ending: null,
  nightsPlayed: 0,
  aceiteraUsed: false,
  ghostReady: true,
  climate: "calm",
  pendingKill: false,
});

export function sanitizeSave(raw: unknown): VigilSave {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Record<string, unknown>;
  const oilRaw = Number(s.oil);
  const migratedEmpty = !Number.isFinite(oilRaw) || ((s.tutorialDone === true || s.seenBrief === true) && oilRaw === 0 && Number(s.nights ?? 0) >= 0 && !s.nightIndex);
  const oil = migratedEmpty ? KIT.oil : clamp(oilRaw, 0, 9999);
  return {
    ...base,
    lang: s.lang === "en" ? "en" : "es",
    nightIndex: clamp(Number(s.nightIndex) || 1, 1, 13),
    oil,
    timber: migratedEmpty ? KIT.timber : clamp(Number(s.timber), 0, 9999),
    iron: migratedEmpty ? KIT.iron : clamp(Number(s.iron), 0, 9999),
    flares: migratedEmpty ? KIT.flares : clamp(Number(s.flares), 0, 20),
    wicks: clamp(Number(s.wicks), 0, 5),
    repairs: migratedEmpty ? KIT.repairs : clamp(Number(s.repairs), 0, 4),
    integrity: clamp(Number(s.integrity) || KIT.integrity, 0, 4),
    guests: asGuests(s.guests),
    relics: asRelics(s.relics ?? s.lastRelics),
    journal: asJournal(s.journal),
    bestiary: typeof s.bestiary === "string" ? s.bestiary.slice(0, 200) : "",
    villageLights: clamp(Number(s.villageLights), 0, 7),
    dailyClaimedDate: typeof s.dailyClaimedDate === "string" ? s.dailyClaimedDate.slice(0, 16) : "",
    dailyTides: clamp(Number(s.dailyTides), 0, 99),
    tutorialBeat: clamp(Number(s.tutorialBeat), 0, 3),
    tutorialDone: s.tutorialDone === true || s.seenBrief === true,
    warnSeen: s.warnSeen === true,
    reducedMotion: s.reducedMotion === true,
    muted: s.muted === true,
    captions: s.captions === true,
    contrast: s.contrast === true,
    bigType: s.bigType === true,
    aimAssist: s.aimAssist === true,
    difficulty: asDiff(s.difficulty),
    sfxVol: clamp(Number(s.sfxVol) || 80, 0, 100),
    shake: s.shake !== false,
    fpsCap: s.fpsCap === true,
    humansBurned: clamp(Number(s.humansBurned), 0, 99),
    visitorsAdmitted: clamp(Number(s.visitorsAdmitted), 0, 99),
    emptyDawnStreak: clamp(Number(s.emptyDawnStreak), 0, 12),
    ending: s.ending === "lights" || s.ending === "alone" || s.ending === "butcher" || s.ending === "openHouse" || s.ending === "tide" ? s.ending : null,
    nightsPlayed: clamp(Number(s.nightsPlayed ?? s.nights), 0, 999),
    aceiteraUsed: s.aceiteraUsed === true,
    ghostReady: s.ghostReady !== false,
    climate: s.climate === "fog" || s.climate === "storm" ? s.climate : "calm",
    pendingKill: s.pendingKill === true,
  };
}

function prefs(clean: VigilSave): VigilSave {
  const fresh = empty();
  fresh.lang = clean.lang;
  fresh.muted = clean.muted;
  fresh.reducedMotion = clean.reducedMotion;
  fresh.captions = clean.captions;
  fresh.contrast = clean.contrast;
  fresh.bigType = clean.bigType;
  fresh.aimAssist = clean.aimAssist;
  fresh.difficulty = clean.difficulty;
  fresh.warnSeen = clean.warnSeen;
  fresh.sfxVol = clean.sfxVol;
  fresh.shake = clean.shake;
  fresh.fpsCap = clean.fpsCap;
  return fresh;
}

function sealed(s: VigilSave) {
  return pickSealed(s as unknown as Record<string, unknown>);
}

function trustedSave(raw: unknown, version: number): VigilSave {
  const clean = sanitizeSave(raw);
  if (version < 8) return clean;
  const hasProgress = clean.nightsPlayed > 0 || clean.tutorialDone || clean.oil !== KIT.oil;
  if (intact(raw, sealed(clean))) return clean;
  if (!hasProgress) return clean;
  return prefs(clean);
}

function csvAdd(raw: string, id: string) {
  const parts = raw.split(",").filter(Boolean);
  if (parts.includes(id)) return raw;
  return [...parts, id].join(",");
}

export function hasMark(raw: string, id: string) {
  return raw.split(",").includes(id);
}

export function missingCraft(have: { oil: number; timber: number; iron: number }, need: { oil?: number; timber?: number; iron?: number }, lang: "es" | "en") {
  const bits: string[] = [];
  const word = (k: "oil" | "timber" | "iron", n: number) => {
    const name = k === "oil" ? (lang === "es" ? "aceite" : "oil") : k === "timber" ? (lang === "es" ? "madera" : "timber") : lang === "es" ? "hierro" : "iron";
    bits.push(lang === "es" ? `Te faltan ${n} ${name}` : `you need ${n} ${name}`);
  };
  if ((need.iron ?? 0) > have.iron) word("iron", (need.iron ?? 0) - have.iron);
  if ((need.oil ?? 0) > have.oil) word("oil", (need.oil ?? 0) - have.oil);
  if ((need.timber ?? 0) > have.timber) word("timber", (need.timber ?? 0) - have.timber);
  return bits.join(" · ");
}

export const useVigil = create<VigilState>()(
  persist(
    (set, get) => ({
      ...empty(),
      setLang: (lang) => set({ lang: lang === "en" ? "en" : "es" }),
      setMuted: (muted) => set({ muted: Boolean(muted) }),
      setMotion: (reducedMotion) => set({ reducedMotion: Boolean(reducedMotion) }),
      setFlag: (k, v) => set({ [k]: Boolean(v) } as Partial<VigilSave>),
      setDiff: (d) => set({ difficulty: asDiff(d) }),
      setVol: (n) => set({ sfxVol: clamp(n, 0, 100) }),
      setShake: (v) => set({ shake: Boolean(v) }),
      importSnap: (raw) => {
        const clean = sanitizeSave(raw);
        if (!clean.tutorialDone && clean.nightsPlayed === 0 && clean.journal.length === 0) return false;
        set({ ...clean });
        return true;
      },
      grantKit: () =>
        set({
          oil: KIT.oil,
          timber: KIT.timber,
          iron: KIT.iron,
          flares: KIT.flares,
          wicks: KIT.wicks,
          repairs: KIT.repairs,
          integrity: KIT.integrity,
        }),
      finishTutorial: (beat = 3) => set({ tutorialDone: true, tutorialBeat: Math.max(beat, get().tutorialBeat) }),
      addCargo: (c) => {
        const s = get();
        set({
          oil: clamp(s.oil + (c.oil ?? 0), 0, 9999),
          timber: clamp(s.timber + (c.timber ?? 0), 0, 9999),
          iron: clamp(s.iron + (c.iron ?? 0), 0, 9999),
        });
      },
      spend: (c) => {
        const s = get();
        if ((c.oil ?? 0) > s.oil || (c.timber ?? 0) > s.timber || (c.iron ?? 0) > s.iron || (c.flares ?? 0) > s.flares) return false;
        set({
          oil: s.oil - (c.oil ?? 0),
          timber: s.timber - (c.timber ?? 0),
          iron: s.iron - (c.iron ?? 0),
          flares: s.flares - (c.flares ?? 0),
        });
        return true;
      },
      spendFlare: () => get().spend({ flares: 1 }),
      craftFlare: () => {
        const s = get();
        if (s.iron < 3 || s.oil < 2) return false;
        set({ iron: s.iron - 3, oil: s.oil - 2, flares: Math.min(20, s.flares + 1) });
        return true;
      },
      craftWick: () => {
        const s = get();
        if (s.timber < 6 || s.oil < 4 || s.wicks >= 5) return false;
        set({ timber: s.timber - 6, oil: s.oil - 4, wicks: s.wicks + 1 });
        return true;
      },
      craftRepair: () => {
        const s = get();
        if (s.timber < 5) return false;
        set({ timber: s.timber - 5, integrity: Math.min(4, s.integrity + 1), repairs: s.repairs + 1 });
        return true;
      },
      setGuests: (guests) => set({ guests }),
      addRelic: (id) => {
        const s = get();
        if (s.relics.includes(id) || s.relics.length >= 3) return;
        set({ relics: [...s.relics, id] });
      },
      addJournal: (p) => set({ journal: [...get().journal, p].slice(-80) }),
      unlockBeast: (id) => set({ bestiary: csvAdd(get().bestiary, id) }),
      setClimate: (climate) => set({ climate }),
      markTide: (date) => {
        const s = get();
        if (s.dailyClaimedDate === date) return;
        set({ dailyClaimedDate: date, dailyTides: s.dailyTides + 1 });
      },
      setEnding: (ending) => set({ ending }),
      applyDawn: ({ oilSpent, cargo, guests, humansBurned, visitorsAdmitted, humansNet, daily }) => {
        const s = get();
        let oil = clamp(s.oil - oilSpent + cargo.oil, 0, 9999);
        if (s.relics.includes("aceitera") && !s.aceiteraUsed) oil = clamp(oil + 20, 0, 9999);
        const oldIds = new Set(s.guests.map((g) => g.id));
        const nextGuests = guests.map((g) => (oldIds.has(g.id) ? { ...g, hunger: g.hunger + 1 } : g));
        const humans = nextGuests.filter((g) => g.kind === "human").length;
        const empty = humans === 0;
        const streak = empty ? s.emptyDawnStreak + 1 : 0;
        const lights = clamp(s.villageLights + Math.max(-1, Math.min(1, humansNet)), 0, 7);
        const nightIndex = Math.min(13, s.nightIndex + 1);
        const visitorsAdmittedN = s.visitorsAdmitted + visitorsAdmitted;
        const humansBurnedN = s.humansBurned + humansBurned;
        let ending: EndingId | null = s.ending;
        if (!ending && nightIndex > 12 && lights >= 5 && visitorsAdmittedN === 0) ending = "lights";
        if (!ending && streak >= 3 && s.nightIndex > 1) ending = "alone";
        if (!ending && humansBurnedN >= 8) ending = "butcher";
        if (!ending && visitorsAdmittedN >= 3) ending = "openHouse";
        const tides = daily && s.dailyClaimedDate !== civilDate() ? s.dailyTides + 1 : s.dailyTides;
        if (!ending && tides >= 7) ending = "tide";
        set({
          oil,
          timber: clamp(s.timber + cargo.timber, 0, 9999),
          iron: clamp(s.iron + cargo.iron, 0, 9999),
          guests: nextGuests,
          villageLights: lights,
          emptyDawnStreak: streak,
          nightIndex,
          nightsPlayed: s.nightsPlayed + 1,
          humansBurned: humansBurnedN,
          visitorsAdmitted: visitorsAdmittedN,
          aceiteraUsed: s.aceiteraUsed || (s.relics.includes("aceitera") && !s.aceiteraUsed),
          ghostReady: true,
          pendingKill: nextGuests.some((g) => g.kind === "visitor"),
          dailyTides: tides,
          dailyClaimedDate: daily ? civilDate() : s.dailyClaimedDate,
          ending,
        });
        return ending;
      },
    }),
    {
      name: "vigil-v6",
      version: 8,
      storage: createJSONStorage(() => safeStorage()),
      migrate: (persisted, version) => {
        const clean = trustedSave(persisted, version);
        return { ...clean, seal: sign(sealed(clean)) } as VigilSave;
      },
      merge: (persisted, current) => {
        const raw = persisted as Record<string, unknown> | undefined;
        if (!raw) return current;
        const hasSig = typeof raw.seal === "string" || typeof raw.integrity === "string";
        const ver = typeof raw.version === "number" ? raw.version : 8;
        const clean = hasSig ? trustedSave(raw, ver) : sanitizeSave(raw);
        return { ...current, ...clean };
      },
      partialize: (s) => {
        const snap = sealed(s);
        return { ...snap, seal: sign(snap) };
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.oil === 0 && state.nightsPlayed === 0) state.grantKit();
      },
    },
  ),
);

if (typeof window !== "undefined" && (import.meta.env.DEV || /\bqa=1\b/.test(window.location.search))) {
  (window as unknown as { __vigil?: typeof useVigil }).__vigil = useVigil;
}
