export type VLang = "es" | "en";
export type Diff = "easy" | "norm" | "hard";
export type RelicId = "farero" | "lastre" | "fantasma" | "vidrio" | "aceitera";
export type SignalId = "noBreath" | "water" | "hands" | "seeksBeam" | "silent" | "echo";
export type BodyKind = "wreck" | "human" | "visitor" | "prime";
export type Side = "port" | "beam" | "star";
export type Dist = "near" | "mid" | "far";
export type EndingId = "lights" | "alone" | "butcher" | "openHouse" | "tide";
export type ClimateId = "calm" | "fog" | "storm";
export type PlayKind = "watch" | "tutorial" | "practice";
export type Hands = "barnacle" | "earth" | "clean";

export interface GuestSigns {
  breath: boolean;
  splash: boolean;
  hands: Hands;
  seeks: boolean;
  silent: boolean;
  echo: boolean;
}

export interface Guest {
  id: string;
  nameEs: string;
  nameEn: string;
  lineEs: string;
  lineEn: string;
  kind: "human" | "visitor";
  trait: SignalId;
  signs: GuestSigns;
  hunger: number;
}

export interface JournalPage {
  id: string;
  date: string;
  night: number;
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  blank?: boolean;
}

export interface SpawnSpec {
  kind: BodyKind;
  side: Side;
  at: number;
  trait?: SignalId;
}

export interface NightLog {
  humansOpened: number;
  humansBurned: number;
  humansLeft: number;
  visitorsOpened: number;
  visitorsBurned: number;
  visitorsLeft: number;
  wrecks: number;
  oilSpent: number;
  cargoOil: number;
  cargoTimber: number;
  cargoIron: number;
  guests: Guest[];
  abandoned: boolean;
}

export const KIT = {
  oil: 60,
  timber: 12,
  iron: 4,
  flares: 1,
  wicks: 0,
  repairs: 1,
  integrity: 3,
} as const;
